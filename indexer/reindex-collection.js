const axios = require('axios');

// Configuration
const INDEXER_URL = 'https://ethereumphunks.onrender.com/admin';
const API_KEY = '75c5d7c962a7ea097f3f6c7dacb95e20afc6aa62de20a8ca04a0973cfecba0f5';
const ETHSCRIPTIONS_API = 'https://api.ethscriptions.com/v2';
const COLLECTION_NAME = 'Ethereum Phunks';
const CONCURRENCY = 5; // Process 5 at a time

/**
 * Fetch all ethscription transaction hashes for the collection
 */
async function fetchAllCollectionTransactions() {
  console.log(`📥 Fetching all transactions for ${COLLECTION_NAME}...`);

  const allHashes = new Set();
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    try {
      const url = `${ETHSCRIPTIONS_API}/ethscriptions?collection=${encodeURIComponent(COLLECTION_NAME)}&page_size=100&page=${page}`;
      console.log(`   Page ${page}...`);

      const response = await axios.get(url);
      const data = response.data;

      if (!data.result || data.result.length === 0) {
        hasMore = false;
        break;
      }

      // Add all transaction hashes
      data.result.forEach(item => {
        if (item.transaction_hash) {
          allHashes.add(item.transaction_hash);
        }
      });

      console.log(`   Found ${data.result.length} items (total unique hashes: ${allHashes.size})`);

      // Check if there are more pages
      hasMore = data.pagination && data.pagination.has_more;
      page++;

      // Rate limit - wait between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`❌ Error fetching page ${page}:`, error.message);
      hasMore = false;
    }
  }

  console.log(`✅ Found ${allHashes.size} unique transaction hashes\n`);
  return Array.from(allHashes);
}

/**
 * Reindex a single transaction
 */
async function reindexTransaction(hash, index, total) {
  try {
    await axios.post(
      `${INDEXER_URL}/reindex-transaction`,
      { hash },
      {
        headers: { 'x-api-key': API_KEY },
        timeout: 30000
      }
    );
    console.log(`✅ [${index}/${total}] ${hash}`);
    return { success: true, hash };
  } catch (error) {
    console.error(`❌ [${index}/${total}] ${hash}: ${error.message}`);
    return { success: false, hash, error: error.message };
  }
}

/**
 * Process transactions in batches with concurrency control
 */
async function processBatch(hashes, startIndex, batchSize) {
  const batch = hashes.slice(startIndex, startIndex + batchSize);
  const promises = batch.map((hash, i) =>
    reindexTransaction(hash, startIndex + i + 1, hashes.length)
  );
  return await Promise.all(promises);
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting collection reindexing...\n');
  const startTime = Date.now();

  // Fetch all transaction hashes
  const hashes = await fetchAllCollectionTransactions();

  if (hashes.length === 0) {
    console.log('⚠️  No transaction hashes found');
    return;
  }

  console.log(`📊 Processing ${hashes.length} transactions with ${CONCURRENCY} concurrent requests...\n`);

  let successCount = 0;
  let failCount = 0;
  const failedHashes = [];

  // Process in batches
  for (let i = 0; i < hashes.length; i += CONCURRENCY) {
    const results = await processBatch(hashes, i, CONCURRENCY);

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
  console.log(`   Total: ${hashes.length}`);
  console.log(`   Duration: ${duration}s`);

  if (failedHashes.length > 0) {
    console.log('\n❌ Failed transactions:');
    failedHashes.forEach(({ hash, error }) => {
      console.log(`   ${hash}: ${error}`);
    });
  }
}

// Run the script
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
