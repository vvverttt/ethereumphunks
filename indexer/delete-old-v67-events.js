/**
 * delete-old-v67-events.js
 *
 * For 3399 updated V67 QuantumPhunks:
 * Deletes all re-pointed old events (hashId=newHash but txHash != newHash)
 * Keeps only the new 'created' events inserted by reindex-v67-activity.js
 *
 * Run: node delete-old-v67-events.js
 * Dry run: DRY_RUN=1 node delete-old-v67-events.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '';
const UPDATES_JSON = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\v67 updates.json';
const CONCURRENCY = 8;
const DRY_RUN = process.env.DRY_RUN === '1';

async function runWithConcurrency(items, concurrency, fn) {
  let i = 0;
  async function worker() { while (i < items.length) { const idx = i++; await fn(items[idx], idx); } }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const updates = require(UPDATES_JSON);
  console.log(`Processing ${updates.length} tokens${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  let deleted = 0, skipped = 0, failed = 0;

  await runWithConcurrency(updates, CONCURRENCY, async (u, idx) => {
    const newHash = u.transactionHash.toLowerCase();

    if (DRY_RUN) {
      const { data } = await supabase
        .from('events')
        .select('txId', { count: 'exact' })
        .eq('hashId', newHash)
        .neq('txHash', newHash);
      if (data?.length) deleted += data.length;
      else skipped++;
      return;
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('hashId', newHash)
      .neq('txHash', newHash);

    if (error) { console.error(`❌ token ${u.number}: ${error.message}`); failed++; }
    else { deleted++; if (deleted % 200 === 0) console.log(`  ✅ ${deleted}/${updates.length} tokens processed`); }
  });

  console.log(`\nDone: ${deleted} tokens processed, ${skipped} skipped (no stale events), ${failed} errors`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
