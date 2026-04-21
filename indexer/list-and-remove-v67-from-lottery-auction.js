/**
 * list-and-remove-v67-from-lottery-auction.js
 *
 * 1. Lists all 3399 updated v67 tokens found in: lottery_wins, auctions, auctionBids, listings, bids
 * 2. With REMOVE=1 env var, deletes them from those tables
 *
 * Run:
 *   node list-and-remove-v67-from-lottery-auction.js          ← list only
 *   REMOVE=1 node list-and-remove-v67-from-lottery-auction.js ← list + remove
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '';
const UPDATES_JSON = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\v67 updates.json';
const REMOVE = process.env.REMOVE === '1';

const TABLES = ['lottery_wins', 'auctions', 'auctionBids', 'listings', 'bids'];

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const updates = require(UPDATES_JSON);
  const hashToNumber = new Map(updates.map(u => [u.transactionHash.toLowerCase(), u.number]));
  const allHashes = [...hashToNumber.keys()];

  console.log(`Checking ${allHashes.length} v67 hashes across tables: ${TABLES.join(', ')}\n`);

  const results = {};

  for (const table of TABLES) {
    const found = [];
    // Query in small batches of 20 (hashes are long)
    const BATCH = 20;
    for (let i = 0; i < allHashes.length; i += BATCH) {
      const batch = allHashes.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .in('hashId', batch);
      if (error) { console.error(`  ❌ ${table} query error:`, error.message); break; }
      if (data?.length) found.push(...data);
    }

    results[table] = found;
    if (found.length) {
      console.log(`📋 ${table}: ${found.length} entries found`);
      found.forEach(row => {
        const num = hashToNumber.get(row.hashId?.toLowerCase());
        console.log(`   token #${num} | hashId: ${row.hashId?.slice(0, 14)}...`);
      });
    } else {
      console.log(`✅ ${table}: none found`);
    }
    console.log();
  }

  if (!REMOVE) {
    const total = Object.values(results).reduce((s, arr) => s + arr.length, 0);
    console.log(`Total: ${total} entries across all tables.`);
    if (total > 0) console.log('\nRun with REMOVE=1 to delete them.');
    return;
  }

  // Remove
  console.log('\n🗑️  Removing...\n');
  for (const table of TABLES) {
    const rows = results[table];
    if (!rows.length) { console.log(`⏭️  ${table}: nothing to remove`); continue; }

    let deleted = 0, failed = 0;
    for (const row of rows) {
      const { error } = await supabase.from(table).delete().eq('hashId', row.hashId);
      if (error) { console.error(`  ❌ ${table} ${row.hashId?.slice(0,12)}: ${error.message}`); failed++; }
      else deleted++;
    }
    console.log(`  ${table}: ${deleted} deleted, ${failed} errors`);
  }

  console.log('\n🎉 Done!');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
