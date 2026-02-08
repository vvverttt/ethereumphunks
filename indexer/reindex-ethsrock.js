const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');

// Configuration
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const INDEXER_URL = 'https://ethereumphunks.onrender.com/admin';
const API_KEY = '75c5d7c962a7ea097f3f6c7dacb95e20afc6aa62de20a8ca04a0973cfecba0f5';
const JSON_FILE = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\EthsRock-with-sha.json';
const SLUG = 'ethsrock';
const CONCURRENCY = 5;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

/**
 * Get all indexed SHAs from the database
 */
async function getIndexedShas() {
  console.log('📥 Fetching indexed SHAs from database...');
  const indexedShas = new Set();
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('ethscriptions')
      .select('sha')
      .eq('slug', SLUG)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error fetching indexed SHAs:', error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    data.forEach(item => indexedShas.add(item.sha));
    hasMore = data.length === pageSize;
    page++;
  }

  console.log(`✅ Found ${indexedShas.size} items already indexed\n`);
  return indexedShas;
}

/**
 * Reindex a single transaction
 */
async function reindexTransaction(hash, index, total, tokenId) {
  try {
    await axios.post(
      `${INDEXER_URL}/reindex-transaction`,
      { hash },
      {
        headers: { 'x-api-key': API_KEY },
        timeout: 30000
      }
    );
    console.log(`✅ [${index}/${total}] TokenId ${tokenId}: ${hash}`);
    return { success: true, hash, tokenId };
  } catch (error) {
    console.error(`❌ [${index}/${total}] TokenId ${tokenId}: ${error.message}`);
    return { success: false, hash, tokenId, error: error.message };
  }
}

/**
 * Process transactions in batches
 */
async function processBatch(transactions, startIndex, total) {
  const promises = transactions.map((item, i) =>
    reindexTransaction(item.hash, startIndex + i + 1, total, item.tokenId)
  );
  return await Promise.all(promises);
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting EthsRock reindex from JSON file...\n');
  const startTime = Date.now();

  // Read JSON file
  console.log('📖 Reading JSON file...');
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  const collectionItems = jsonData.collection_items;
  console.log(`✅ Loaded ${collectionItems.length} items from JSON\n`);

  // Get indexed SHAs
  const indexedShas = await getIndexedShas();

  // Find missing items
  const missingItems = collectionItems.filter(item => !indexedShas.has(item.sha));

  console.log(`📊 Summary:`);
  console.log(`   Total items in JSON: ${collectionItems.length}`);
  console.log(`   Already indexed: ${indexedShas.size}`);
  console.log(`   Missing (to be indexed): ${missingItems.length}\n`);

  if (missingItems.length === 0) {
    console.log('✅ All items are already indexed!');
    return;
  }

  console.log(`📊 Processing ${missingItems.length} missing items with ${CONCURRENCY} concurrent requests...\n`);

  // Prepare transaction list
  const transactions = missingItems.map(item => ({
    hash: item.id,
    tokenId: item.index,
    sha: item.sha
  }));

  let successCount = 0;
  let failCount = 0;
  const failedHashes = [];

  // Process in batches
  for (let i = 0; i < transactions.length; i += CONCURRENCY) {
    const batch = transactions.slice(i, i + CONCURRENCY);
    const results = await processBatch(batch, i, transactions.length);

    results.forEach(result => {
      if (result.success) {
        successCount++;
      } else {
        failCount++;
        failedHashes.push(result);
      }
    });

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  console.log('\n🎉 Reindexing complete!');
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total processed: ${transactions.length}`);
  console.log(`   Duration: ${duration}s`);

  if (failedHashes.length > 0 && failedHashes.length < 50) {
    console.log('\n❌ Failed transactions:');
    failedHashes.forEach(({ hash, tokenId, error }) => {
      console.log(`   TokenId ${tokenId}: ${hash}`);
      console.log(`      Error: ${error}`);
    });
  }
}

// Run the script
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
