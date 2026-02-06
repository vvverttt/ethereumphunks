const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const ETHSCRIPTIONS_API = 'https://mainnet-api.ethscriptions.com/api';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

/**
 * Fetch transfers from Ethscriptions API
 */
async function fetchTransfersFromAPI(hashId) {
  try {
    const response = await axios.get(`${ETHSCRIPTIONS_API}/ethscriptions/${hashId}/transfers`, {
      timeout: 30000
    });
    return response.data;
  } catch (error) {
    console.error(`  ❌ Error fetching transfers for ${hashId}:`, error.message);
    return null;
  }
}

/**
 * Main function to fetch and display transfer data
 */
async function main() {
  console.log('🔍 Fetching transfer data from Ethscriptions API...\n');

  // Get transferred ethscriptions
  let allEthscriptions = [];
  let start = 0;
  const chunkSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('ethscriptions')
      .select('hashId, creator, owner, sha')
      .eq('slug', 'cryptophunksv67')
      .range(start, start + chunkSize - 1);

    if (!data || data.length === 0) break;
    allEthscriptions = allEthscriptions.concat(data);
    if (data.length < chunkSize) break;
    start += chunkSize;
  }

  const transferred = allEthscriptions.filter(e =>
    e.creator.toLowerCase() !== e.owner.toLowerCase()
  );

  console.log(`Found ${transferred.length} transferred ethscriptions\n`);

  const transferData = [];

  for (const eth of transferred) {
    console.log(`Checking ${eth.hashId}...`);

    const transfers = await fetchTransfersFromAPI(eth.hashId);

    if (transfers && transfers.result && transfers.result.length > 0) {
      console.log(`  ✅ Found ${transfers.result.length} transfer(s)`);

      transfers.result.forEach((transfer, idx) => {
        console.log(`    [${idx + 1}] Block ${transfer.block_number}`);
        console.log(`        From: ${transfer.from_address}`);
        console.log(`        To: ${transfer.to_address}`);
        console.log(`        Tx: ${transfer.transaction_hash}`);
        console.log(`        Timestamp: ${transfer.block_timestamp}`);
      });

      transferData.push({
        hashId: eth.hashId,
        transfers: transfers.result
      });
    } else {
      console.log(`  ⚠️  No transfers found (might be bridge/escrow)`);
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`  Transferred ethscriptions: ${transferred.length}`);
  console.log(`  With transfer data: ${transferData.length}`);
  console.log(`  Without transfer data: ${transferred.length - transferData.length}`);

  if (transferData.length > 0) {
    console.log(`\n✅ Transfer events can be created for ${transferData.length} ethscriptions`);
    console.log(`   Use the transaction hashes to fetch block data and create transfer events`);
  }

  return transferData;
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
