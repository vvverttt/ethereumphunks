/**
 * fix-v67-lottery-ownership.js
 *
 * After withdrawing 2820 old v67 hashIds from the lottery contracts,
 * this updates ethscriptions.owner for the corresponding NEW hashIds
 * (looked up via oldHashId column) to the recipient address.
 *
 * Run: SUPABASE_SERVICE_ROLE=... node fix-v67-lottery-ownership.js
 * Dry run: DRY_RUN=1 SUPABASE_SERVICE_ROLE=... node fix-v67-lottery-ownership.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '';
const CONTRACTS_FILE = 'C:/Users/alber/OneDrive/Desktop/market/v67-in-lottery-contracts.txt';
const RECIPIENT = '0xea04f65f9dc5917302532859d80fcf36a15de266';
const DRY_RUN = process.env.DRY_RUN === '1';
const BATCH_SIZE = 50;

function parseAllOldHashIds(file) {
  const content = fs.readFileSync(file, 'utf8');
  const hashIds = [];

  for (const label of ['LOTTERY 1 FULL LIST', 'LOTTERY 2 FULL LIST']) {
    const idx = content.indexOf(`--- ${label}`);
    if (idx === -1) continue;
    const section = content.slice(idx);
    const lines = section.split('\n').slice(1);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('===') || t.startsWith('---')) break;
      const parts = t.split('|');
      if (parts.length >= 2 && parts[1].trim().startsWith('0x')) {
        hashIds.push(parts[1].trim().toLowerCase());
      }
    }
  }
  return hashIds;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const oldHashIds = parseAllOldHashIds(CONTRACTS_FILE);

  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Updating owner for ${oldHashIds.length} tokens`);
  console.log(`Recipient: ${RECIPIENT}\n`);

  let updated = 0, notFound = 0, failed = 0;

  for (let i = 0; i < oldHashIds.length; i += BATCH_SIZE) {
    const batch = oldHashIds.slice(i, i + BATCH_SIZE);

    if (DRY_RUN) {
      const { data, error } = await supabase
        .from('ethscriptions')
        .select('hashId, oldHashId, owner')
        .in('oldHashId', batch);

      if (error) { console.error(`Batch ${Math.floor(i/BATCH_SIZE)+1} error:`, error.message); failed += batch.length; continue; }
      updated += data?.length || 0;
      notFound += batch.length - (data?.length || 0);
    } else {
      const { data, error } = await supabase
        .from('ethscriptions')
        .update({ owner: RECIPIENT })
        .in('oldHashId', batch)
        .select('hashId');

      if (error) { console.error(`Batch ${Math.floor(i/BATCH_SIZE)+1} error:`, error.message); failed += batch.length; continue; }
      updated += data?.length || 0;
      notFound += batch.length - (data?.length || 0);
    }

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= oldHashIds.length) {
      console.log(`  ✅ ${Math.min(i + BATCH_SIZE, oldHashIds.length)}/${oldHashIds.length} processed`);
    }
  }

  console.log(`\nDone: ${updated} updated, ${notFound} not found (no oldHashId match), ${failed} errors`);
  if (DRY_RUN) console.log('Re-run without DRY_RUN=1 to apply.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
