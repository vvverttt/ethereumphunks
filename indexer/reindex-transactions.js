const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Configuration
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const INDEXER_URL = 'http://localhost:3069/admin';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

/**
 * Fetch all unique transaction hashes from the events table
 */
async function fetchTransactionHashes() {
  console.log('📥 Fetching transaction hashes from Supabase...');

  const { data, error } = await supabase
    .from('events')
    .select('txHash')
    .not('txHash', 'is', null);

  if (error) {
    console.error('❌ Error fetching transaction hashes:', error);
    throw error;
  }

  // Get unique transaction hashes
  const uniqueHashes = [...new Set(data.map(row => row.txHash))];
  console.log(`✅ Found ${uniqueHashes.length} unique transaction hashes`);

  return uniqueHashes;
}

/**
 * Reindex a single transaction
 */
async function reindexTransaction(hash) {
  try {
    await axios.post(`${INDEXER_URL}/reindex-transaction`, { hash });
    return true;
  } catch (error) {
    console.error(`❌ Failed to reindex ${hash}:`, error.message);
    return false;
  }
}

/**
 * Reindex all transactions with progress tracking
 */
async function reindexAll() {
  console.log('🚀 Starting transaction reindexing...\n');

  const hashes = await fetchTransactionHashes();

  if (hashes.length === 0) {
    console.log('⚠️  No transaction hashes found in database');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  console.log(`\n📊 Processing ${hashes.length} transactions...\n`);

  for (let i = 0; i < hashes.length; i++) {
    const hash = hashes[i];
    const success = await reindexTransaction(hash);

    if (success) {
      successCount++;
      console.log(`✅ [${i + 1}/${hashes.length}] ${hash}`);
    } else {
      failCount++;
      console.log(`❌ [${i + 1}/${hashes.length}] ${hash}`);
    }

    // Add a small delay to avoid overwhelming the indexer
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n🎉 Reindexing complete!');
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total: ${hashes.length}`);
}

// Run the script
reindexAll().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
