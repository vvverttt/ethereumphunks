const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Configuration
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const INDEXER_URL = 'https://ethereumphunks.onrender.com/admin';
const API_KEY = '75c5d7c962a7ea097f3f6c7dacb95e20afc6aa62de20a8ca04a0973cfecba0f5';
const CONCURRENCY = 5;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

/**
 * Fetch all unique transaction hashes from ethscriptions table
 */
async function fetchAllTransactionHashes() {
  console.log('📥 Fetching all transaction hashes from Supabase ethscriptions table...');

  const allHashes = new Set();
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('ethscriptions')
      .select('hashId, slug')
      .not('hashId', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error fetching from Supabase:', error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    data.forEach(row => {
      if (row.hashId) {
        allHashes.add(row.hashId);
      }
    });

    console.log(`   Page ${page + 1}: Found ${data.length} records (total unique hashes: ${allHashes.size})`);

    hasMore = data.length === pageSize;
    page++;
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
 * Process transactions in batches
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
  console.log('🚀 Starting full reindex from Supabase ethscriptions...\n');
  const startTime = Date.now();

  // Fetch all transaction hashes from Supabase
  const hashes = await fetchAllTransactionHashes();

  if (hashes.length === 0) {
    console.log('⚠️  No transaction hashes found in Supabase');
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

  if (failedHashes.length > 0 && failedHashes.length < 50) {
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
