/**
 * Tells the indexer to (re)process each Phunklloween creation tx so it tags them
 * with slug=phunklloween and inserts the ethscriptions rows.
 *
 * Run AFTER import-phunklloween.js has populated attributes_new — the indexer learns
 * the collection by matching each tx's sha against that table, so reindexing first
 * is a silent no-op that looks like success.
 *
 * Hits POST {INDEXER_URL}/admin/reindex-transaction { hash } with the x-admin-key header.
 *
 *   INDEXER_URL=https://ethereumphunks.onrender.com INDEXER_ADMIN_KEY=<key> node reindex-phunklloween.js
 *
 * Both values are read from the environment and never stored in this file.
 */
const fs = require('fs');
const path = require('path');

const INDEXER_URL = (process.env.INDEXER_URL || 'https://ethereumphunks.onrender.com').replace(/\/$/, '');
const ADMIN_KEY = process.env.INDEXER_ADMIN_KEY;
const MANIFEST = path.join(__dirname, '_phunklloween.json');

if (!ADMIN_KEY) {
  console.error('❌ Set INDEXER_ADMIN_KEY in the environment.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const items = manifest.collection_items;
  console.log(`🔁 Reindexing ${items.length} Phunklloween txs at ${INDEXER_URL}\n`);

  let ok = 0, fail = 0;
  for (const item of items) {
    try {
      const res = await fetch(`${INDEXER_URL}/admin/reindex-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
        body: JSON.stringify({ hash: item.id }),
      });
      if (res.ok) { ok++; console.log(`   ✅ ${item.index} ${item.name}`); }
      else { fail++; console.log(`   ❌ ${item.index} -> ${res.status} ${(await res.text()).slice(0, 120)}`); }
    } catch (e) {
      fail++; console.log(`   ❌ ${item.index} -> ${e.message}`);
    }
    await sleep(400); // be gentle on the indexer/RPC
  }
  console.log(`\nDone. ok: ${ok}, fail: ${fail}`);
  if (ok === items.length) {
    console.log('\nVerify with:');
    console.log(`  curl "https://kfnprbhoodmgfhqojmqp.supabase.co/rest/v1/ethscriptions?slug=eq.${manifest.slug}&select=tokenId,sha,owner&apikey=<publishable>"`);
    console.log(`  expect ${items.length} rows`);
  }
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
