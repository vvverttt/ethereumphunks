/**
 * Writes the `ethscriptions` rows + `created` events for Phunklloween directly.
 *
 * Why this exists rather than reindexing through the indexer:
 * the normal route is POST /admin/reindex-transaction, which needs INDEXER_ADMIN_KEY.
 * The other route — rewinding the `blocks` checkpoint and restarting — does not work
 * reliably, because the running indexer rewrites that checkpoint every ~12s and
 * re-reads it on any internal retry, so the rewind is clobbered before the backfill
 * reaches the blocks you care about. Tried it on 2026-10-09; produced nothing.
 *
 * Every field below mirrors the indexer's own writers exactly:
 *   - the row shape is storage.service.ts addEthscription()
 *   - the event shape is ethscriptions.service.ts processEthscriptionCreationEvent()
 *   - txId is `${txHash}${txIndex}` lowercased, matching that function (NOT the
 *     `${hash}-${index}-${i}` fallback addEvents() applies only when txId is unset)
 * Keep them in sync if those change.
 *
 * Transaction fields come from chain, never from the manifest, and each sha is
 * recomputed the way the indexer computes it (hex -> utf8, strip NULs, sha256) and
 * checked before anything is written.
 *
 * Idempotent: an item that already has a row is skipped, so re-running is safe.
 *
 *   SUPABASE_SERVICE_ROLE=<key> node insert-phunklloween-rows.js        # dry run
 *   SUPABASE_SERVICE_ROLE=<key> RUN=1 node insert-phunklloween-rows.js  # write
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE;
const LIVE = process.env.RUN === '1';
const MANIFEST = path.join(__dirname, '_phunklloween.json');
const ZERO = '0x0000000000000000000000000000000000000000';

const RPCS = [
  'https://eth.drpc.org',
  'https://ethereum-rpc.publicnode.com',
  'https://rpc.mevblocker.io',
  'https://1rpc.io/eth',
];

if (!KEY) { console.error('❌ Set SUPABASE_SERVICE_ROLE.'); process.exit(1); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sb(method, pathAndQuery, body, extraHeaders = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: { ...H, ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
  if (!res.ok) throw new Error(`${method} ${pathAndQuery} -> ${res.status} ${text.slice(0, 200)}`);
  return json;
}

let rr = 0;
async function rpc(method, params) {
  let lastErr;
  for (let i = 0; i < RPCS.length * 2; i++) {
    const url = RPCS[rr++ % RPCS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(20000),
      });
      const d = await res.json();
      if (d?.result) return d.result;
      lastErr = new Error(d?.error?.message || 'empty result');
    } catch (e) { lastErr = e; }
    await sleep(350);
  }
  throw new Error(`${method} failed: ${lastErr?.message}`);
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const items = manifest.collection_items;
  console.log(`🎃 ${manifest.name}: ${items.length} items${LIVE ? '' : '   (DRY RUN — add RUN=1 to write)'}\n`);

  // ---- gather + verify everything from chain before any write ---------------------
  const planned = [];
  for (const item of items) {
    const existing = await sb('GET', `ethscriptions?hashId=eq.${item.id.toLowerCase()}&select=hashId,slug,tokenId`);
    if (existing.length) {
      console.log(`   ⏭️  ${item.index} ${item.name.padEnd(17)} already present (${existing[0].slug} #${existing[0].tokenId})`);
      continue;
    }

    const tx = await rpc('eth_getTransactionByHash', [item.id]);
    if (!tx) throw new Error(`${item.index}: tx not found`);

    // The indexer's own sha: hex -> utf8, strip NULs, sha256.
    const raw = Buffer.from(tx.input.slice(2), 'hex').toString('utf8').replace(/\x00/g, '');
    const sha = crypto.createHash('sha256').update(raw).digest('hex');
    if (sha !== item.sha) throw new Error(`${item.index}: sha mismatch (chain ${sha} vs manifest ${item.sha})`);

    // attributes_new is what makes the indexer treat this sha as curated. If it is not
    // there, the row would be an orphan the site cannot render traits for.
    const attr = await sb('GET', `attributes_new?sha=eq.${sha}&select=sha,slug,tokenId`);
    if (!attr.length) throw new Error(`${item.index}: no attributes_new row — run import-phunklloween.js first`);
    if (attr[0].slug !== manifest.slug || attr[0].tokenId !== item.index) {
      throw new Error(`${item.index}: attributes_new disagrees (${attr[0].slug} #${attr[0].tokenId})`);
    }

    const block = await rpc('eth_getBlockByNumber', [tx.blockNumber, false]);
    const createdAt = new Date(parseInt(block.timestamp, 16) * 1000).toISOString();
    const txIndex = parseInt(tx.transactionIndex, 16);
    const from = tx.from.toLowerCase();
    const to = (tx.to || ZERO).toLowerCase();

    planned.push({
      item,
      from,
      to,
      createdAt,
      row: {
        createdAt,
        creator: from,
        prevOwner: from,
        owner: to,
        hashId: item.id.toLowerCase(),
        sha: attr[0].sha,
        slug: attr[0].slug,
        tokenId: attr[0].tokenId,
      },
      event: {
        txId: (tx.hash + txIndex).toLowerCase(),
        type: 'created',
        hashId: item.id.toLowerCase(),
        from,
        to,
        blockHash: tx.blockHash.toLowerCase(),
        txIndex,
        txHash: tx.hash.toLowerCase(),
        blockNumber: parseInt(tx.blockNumber, 16),
        blockTimestamp: createdAt,
        value: '0',
      },
    });
    console.log(`   ✅ ${item.index} ${item.name.padEnd(17)} blk ${parseInt(tx.blockNumber, 16)}  owner ${to.slice(0, 10)}…  sha ok`);
  }

  if (!planned.length) { console.log('\nNothing to do — all items already present.'); return; }
  console.log(`\n${planned.length} to insert.`);

  if (!LIVE) {
    console.log('\nSample row :', JSON.stringify(planned[0].row, null, 2));
    console.log('Sample event:', JSON.stringify(planned[0].event, null, 2));
    console.log('\nDRY RUN — nothing written. Re-run with RUN=1.');
    return;
  }

  // ---- users first: the ethscriptions FK expects creator/owner to exist -----------
  const addrs = [...new Set(planned.flatMap((p) => [p.from, p.to]))];
  console.log(`\n👤 Ensuring ${addrs.length} users...`);
  for (const a of addrs) {
    const found = await sb('GET', `users?address=eq.${a}&select=address`);
    if (found.length) { console.log(`   · ${a} exists`); continue; }
    await sb('POST', 'users', [{ address: a, createdAt: new Date().toISOString() }], { Prefer: 'return=minimal' });
    console.log(`   + ${a} created`);
  }

  console.log('\n📝 Inserting ethscriptions...');
  await sb('POST', 'ethscriptions', planned.map((p) => p.row), { Prefer: 'return=minimal' });
  console.log(`   ✅ ${planned.length} rows`);

  console.log('\n📝 Inserting created events...');
  await sb('POST', 'events', planned.map((p) => p.event), { Prefer: 'return=minimal,resolution=ignore-duplicates' });
  console.log(`   ✅ ${planned.length} events`);

  // `name` is a separate step on purpose: addEthscription() does not set it, so the
  // insert above stays byte-for-byte what the indexer would have written. Phikings
  // got its names ("Odin", "Thor", …) the same way, after the rows existed. This is
  // what renders as the item title on the details page.
  console.log('\n🏷️  Setting names...');
  for (const p of planned) {
    await sb('PATCH', `ethscriptions?hashId=eq.${p.row.hashId}`, { name: p.item.name }, { Prefer: 'return=minimal' });
    console.log(`   #${p.item.index}  ${p.item.name}`);
  }

  const check = await sb('GET', `ethscriptions?slug=eq.${manifest.slug}&select=tokenId,name,owner&order=tokenId.asc`);
  console.log(`\n🎉 ${manifest.slug} now has ${check.length} rows:`);
  check.forEach((r) => console.log(`   #${r.tokenId}  ${String(r.name).padEnd(17)} ${r.owner}`));
}

main().catch((e) => { console.error('💥', e.message || e); process.exit(1); });
