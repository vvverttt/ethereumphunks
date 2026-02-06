const fs = require('fs');
const axios = require('axios');

// Configuration
const JSON_FILE_PATH = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\cryptophunks-v67.json';
const INDEXER_URL = 'http://localhost:3069/admin';
const API_KEY = '75c5d7c962a7ea097f3f6c7dacb95e20afc6aa62de20a8ca04a0973cfecba0f5'; // From .env
const BATCH_SIZE = 10; // Process in batches to avoid overwhelming the indexer
const DELAY_MS = 500; // Delay between batches

/**
 * Read transaction hashes from JSON file
 */
function readTransactionHashes() {
  console.log('📥 Reading transaction hashes from JSON file...');

  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf8'));

  if (!jsonData.collection_items || !Array.isArray(jsonData.collection_items)) {
    throw new Error('Invalid JSON structure: collection_items not found');
  }

  const hashes = jsonData.collection_items
    .map(item => item.id)
    .filter(id => id && id.startsWith('0x'));

  console.log(`✅ Found ${hashes.length} transaction hashes in JSON file`);
  return hashes;
}

/**
 * Reindex a single transaction
 */
async function reindexTransaction(hash) {
  try {
    await axios.post(`${INDEXER_URL}/reindex-transaction`, { hash }, {
      timeout: 30000, // 30 second timeout
      headers: {
        'x-api-key': API_KEY
      }
    });
    return { success: true, hash };
  } catch (error) {
    return {
      success: false,
      hash,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Reindex transactions in batches
 */
async function reindexAll() {
  console.log('🚀 Starting transaction reindexing from JSON...\n');

  const hashes = readTransactionHashes();

  if (hashes.length === 0) {
    console.log('⚠️  No transaction hashes found in JSON file');
    return;
  }

  let successCount = 0;
  let failCount = 0;
  const failures = [];

  console.log(`\n📊 Processing ${hashes.length} transactions in batches of ${BATCH_SIZE}...\n`);

  // Process in batches
  for (let i = 0; i < hashes.length; i += BATCH_SIZE) {
    const batch = hashes.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(hashes.length / BATCH_SIZE);

    console.log(`\n🔄 Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, hashes.length)} of ${hashes.length})`);

    // Process batch in parallel
    const results = await Promise.all(
      batch.map(hash => reindexTransaction(hash))
    );

    // Count results
    results.forEach((result, idx) => {
      const itemNum = i + idx + 1;
      if (result.success) {
        successCount++;
        console.log(`  ✅ [${itemNum}/${hashes.length}] ${result.hash.substring(0, 10)}...`);
      } else {
        failCount++;
        failures.push(result);
        console.log(`  ❌ [${itemNum}/${hashes.length}] ${result.hash.substring(0, 10)}... - ${result.error}`);
      }
    });

    // Delay between batches (except for the last batch)
    if (i + BATCH_SIZE < hashes.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('\n🎉 Reindexing complete!');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📊 Total: ${hashes.length}`);
  console.log(`   📈 Success Rate: ${((successCount / hashes.length) * 100).toFixed(2)}%`);

  if (failures.length > 0) {
    console.log('\n⚠️  Failed transactions:');
    failures.slice(0, 10).forEach(f => {
      console.log(`   ${f.hash} - ${f.error}`);
    });
    if (failures.length > 10) {
      console.log(`   ... and ${failures.length - 10} more`);
    }
  }
}

// Run the script
reindexAll().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
