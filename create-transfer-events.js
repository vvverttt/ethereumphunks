const { createClient } = require('@supabase/supabase-js');
const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');
const axios = require('axios');

// Configuration
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const RPC_URL = 'https://eth-mainnet.g.alchemy.com/v2/C2mkwU9xTr2HarApFpqbO';
const ETHSCRIPTIONS_API = 'https://mainnet-api.ethscriptions.com/api';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Create viem client
const client = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL)
});

/**
 * Fetch transfer data from Ethscriptions API
 */
async function fetchTransfersFromAPI(hashId) {
  try {
    const response = await axios.get(`${ETHSCRIPTIONS_API}/ethscriptions/${hashId}/transfers`, {
      timeout: 30000
    });
    return response.data?.result || [];
  } catch (error) {
    console.error(`  ❌ Error fetching transfers for ${hashId}:`, error.message);
    return [];
  }
}

/**
 * Get blockchain data for transaction
 */
async function getTransactionData(txHash) {
  try {
    const tx = await client.getTransaction({ hash: txHash });
    const block = await client.getBlock({ blockNumber: tx.blockNumber });

    return {
      blockNumber: Number(tx.blockNumber),
      blockHash: tx.blockHash,
      blockTimestamp: new Date(Number(block.timestamp) * 1000),
      txIndex: tx.transactionIndex
    };
  } catch (error) {
    console.error(`❌ Error fetching tx ${txHash}:`, error.message);
    return null;
  }
}

/**
 * Create transfer events
 */
async function createTransferEvents() {
  console.log('🚀 Creating transfer events for transferred phunks...\n');

  // Get transferred ethscriptions
  let allEthscriptions = [];
  let start = 0;
  const chunkSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('ethscriptions')
      .select('tokenId, hashId, creator, owner, sha')
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

  const transferEvents = [];
  let successCount = 0;
  let failCount = 0;

  for (const eth of transferred) {
    console.log(`\n🔍 Processing Phunk #${eth.tokenId}...`);
    console.log(`   hashId: ${eth.hashId.substring(0, 10)}...`);

    // Fetch transfers from API
    const transfers = await fetchTransfersFromAPI(eth.hashId);

    if (transfers.length === 0) {
      console.log(`   ⚠️  No transfers found in API`);
      failCount++;
      continue;
    }

    console.log(`   Found ${transfers.length} transfer(s)`);

    // Process each transfer
    for (let i = 0; i < transfers.length; i++) {
      const transfer = transfers[i];
      console.log(`\n   Transfer ${i + 1}:`);
      console.log(`     From: ${transfer.from_address}`);
      console.log(`     To: ${transfer.to_address}`);
      console.log(`     Block: ${transfer.block_number}`);
      console.log(`     Tx: ${transfer.transaction_hash.substring(0, 10)}...`);

      // Get blockchain data
      const blockData = await getTransactionData(transfer.transaction_hash);

      if (!blockData) {
        console.log(`     ❌ Failed to fetch blockchain data`);
        failCount++;
        continue;
      }

      // Check if event already exists
      const { data: existing } = await supabase
        .from('events')
        .select('txId')
        .eq('txHash', transfer.transaction_hash)
        .eq('hashId', eth.hashId)
        .eq('type', 'transfer')
        .single();

      if (existing) {
        console.log(`     ⚠️  Transfer event already exists`);
        continue;
      }

      // Create transfer event
      const event = {
        type: 'transfer',
        hashId: eth.hashId.toLowerCase(),
        txHash: transfer.transaction_hash.toLowerCase(),
        txId: transfer.transaction_hash.toLowerCase() + '-' + i,
        from: transfer.from_address.toLowerCase(),
        to: transfer.to_address.toLowerCase(),
        blockNumber: blockData.blockNumber,
        blockHash: blockData.blockHash,
        blockTimestamp: blockData.blockTimestamp,
        txIndex: blockData.txIndex,
        value: '0',
      };

      transferEvents.push(event);
      console.log(`     ✅ Created transfer event`);
      successCount++;
    }

    // Rate limit between phunks
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Insert all events at once
  if (transferEvents.length > 0) {
    console.log(`\n\n📊 Inserting ${transferEvents.length} transfer events...\n`);

    const { error } = await supabase
      .from('events')
      .insert(transferEvents);

    if (error) {
      console.error('❌ Error inserting events:', error);
    } else {
      console.log('✅ All transfer events inserted successfully!');
    }
  }

  console.log('\n🎉 Transfer event creation complete!');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📊 Total: ${transferred.length} phunks processed`);
}

// Run the script
createTransferEvents().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
