const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const INDEXER_URL = 'https://ethereumphunks.onrender.com/admin';
const API_KEY = '75c5d7c962a7ea097f3f6c7dacb95e20afc6aa62de20a8ca04a0973cfecba0f5';
const SLUG = 'ethsrock';
const CONCURRENCY = 3;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function main() {
  console.log('Starting EthsRock transfer event indexing...\n');

  // Step 1: Get all ethsrock hashIds
  console.log('Fetching ethsrock items from DB...');
  const { data: items, error } = await supabase
    .from('ethscriptions')
    .select('hashId, tokenId')
    .eq('slug', SLUG);

  if (error) { console.error('DB error:', error); return; }
  console.log(`Found ${items.length} ethsrock items\n`);

  // Step 2: Collect transfer tx hashes from ethscriptions API
  console.log('Fetching transfer history from ethscriptions API...');
  const transferTxHashes = new Set();
  let itemsWithTransfers = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const res = await axios.get('https://api.ethscriptions.com/v2/ethscription_transfers', {
        params: { ethscription_transaction_hash: item.hashId }
      });

      const transfers = res.data.result || [];
      for (const t of transfers) {
        // Skip the creation transfer (same hash as ethscription)
        if (t.transaction_hash.toLowerCase() === item.hashId.toLowerCase()) continue;
        transferTxHashes.add(t.transaction_hash.toLowerCase());
      }

      if (transfers.length > 1) itemsWithTransfers++;

      if ((i + 1) % 20 === 0) {
        console.log(`  Progress: ${i + 1}/${items.length} (found ${transferTxHashes.size} unique transfer txs)`);
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`  Error for tokenId ${item.tokenId}: ${err.message}`);
    }
  }

  console.log(`\nFound ${transferTxHashes.size} unique transfer transactions across ${itemsWithTransfers} items\n`);

  if (transferTxHashes.size === 0) {
    console.log('No transfers to index!');
    return;
  }

  // Step 3: Feed transfer tx hashes to indexer
  console.log(`Indexing ${transferTxHashes.size} transfer transactions...\n`);
  const txList = Array.from(transferTxHashes);
  let success = 0;
  let fail = 0;

  for (let i = 0; i < txList.length; i += CONCURRENCY) {
    const batch = txList.slice(i, i + CONCURRENCY);
    const promises = batch.map((hash, j) =>
      axios.post(
        `${INDEXER_URL}/reindex-transaction`,
        { hash },
        { headers: { 'x-api-key': API_KEY }, timeout: 30000 }
      )
      .then(() => {
        console.log(`  [${i + j + 1}/${txList.length}] ${hash}`);
        success++;
      })
      .catch(err => {
        console.error(`  [${i + j + 1}/${txList.length}] FAILED ${hash}: ${err.message}`);
        fail++;
      })
    );

    await Promise.all(promises);
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nDone! Success: ${success}, Failed: ${fail}`);

  // Verify events
  const { data: ethsrockItems } = await supabase
    .from('ethscriptions')
    .select('hashId')
    .eq('slug', SLUG);

  const hashIds = ethsrockItems.map(i => i.hashId);
  const { data: events } = await supabase
    .from('events')
    .select('type')
    .in('hashId', hashIds);

  const typeCounts = {};
  events.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });
  console.log('\nFinal events by type:', typeCounts);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
