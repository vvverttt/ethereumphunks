/**
 * fix-stale-owners.js
 *
 * Finds all cryptophunksv67 tokens where the DB owner doesn't match
 * the most recent transfer recipient, then fixes them.
 *
 * Run (dry):  SUPABASE_SERVICE_ROLE=... node fix-stale-owners.js
 * Run (fix):  DRY_RUN=0 SUPABASE_SERVICE_ROLE=... node fix-stale-owners.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const DRY_RUN = process.env.DRY_RUN !== '0';
const SLUG = 'cryptophunksv67';

async function fetchAll(supabase, table, select, filters = {}) {
  let rows = [], page = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(page * 1000, (page + 1) * 1000 - 1);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw new Error(`${table} fetch error: ${error.message}`);
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  return rows;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('Fetching all ethscriptions...');
  const ethscriptions = await fetchAll(supabase, 'ethscriptions', 'tokenId,hashId,owner', { slug: SLUG });
  console.log(`  ${ethscriptions.length} tokens\n`);

  console.log('Fetching all events...');
  const allEvents = await fetchAll(supabase, 'events', 'hashId,to,blockNumber,txIndex,type');
  // Only ownership-changing events
  const events = allEvents.filter(e => e.type === 'transfer' || e.type === 'created');
  console.log(`  ${allEvents.length} total events, ${events.length} ownership events (transfer/created)\n`);

  // Build map: hashId -> latest event (by blockNumber, then txIndex)
  const latestTransfer = new Map();
  for (const t of events) {
    if (!t.to) continue; // skip events with no recipient
    const existing = latestTransfer.get(t.hashId);
    if (!existing || t.blockNumber > existing.blockNumber ||
        (t.blockNumber === existing.blockNumber && t.txIndex > existing.txIndex)) {
      latestTransfer.set(t.hashId, t);
    }
  }

  const mismatches = [];
  const noTransfer = [];

  for (const e of ethscriptions) {
    const latest = latestTransfer.get(e.hashId);
    if (!latest) {
      noTransfer.push(e);
      continue;
    }
    const latestOwner = latest.to.toLowerCase();
    const dbOwner = e.owner.toLowerCase();
    if (dbOwner !== latestOwner) {
      mismatches.push({ tokenId: e.tokenId, hashId: e.hashId, dbOwner, correctOwner: latestOwner });
    }
  }

  console.log(`=== Results ===`);
  console.log(`Stale owners (mismatch with latest transfer): ${mismatches.length}`);
  mismatches.forEach(m => console.log(`  #${m.tokenId}: DB=${m.dbOwner.slice(0,10)}... correct=${m.correctOwner.slice(0,10)}...`));

  console.log(`\nTokens with no transfers (owner = minter): ${noTransfer.length}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Re-run with DRY_RUN=0 to fix.');
    return;
  }

  if (mismatches.length === 0) {
    console.log('\nNothing to fix.');
    return;
  }

  console.log('\nFixing stale owners...');
  let fixed = 0, failed = 0;
  for (const m of mismatches) {
    const { error } = await supabase.from('ethscriptions')
      .update({ owner: m.correctOwner })
      .eq('hashId', m.hashId)
      .eq('slug', SLUG);
    if (error) {
      console.error(`  #${m.tokenId} error: ${error.message}`);
      failed++;
    } else {
      console.log(`  ✅ #${m.tokenId} ${m.dbOwner.slice(0,10)}... → ${m.correctOwner.slice(0,10)}...`);
      fixed++;
    }
  }
  console.log(`\nDone: ${fixed} fixed, ${failed} errors`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
