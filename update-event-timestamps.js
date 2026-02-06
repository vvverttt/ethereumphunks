const { createClient } = require('@supabase/supabase-js');
const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');

// Configuration
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const RPC_URL = 'https://eth-mainnet.g.alchemy.com/v2/C2mkwU9xTr2HarApFpqbO'; // From indexer .env
const BATCH_SIZE = 50; // Process in batches
const DELAY_MS = 1000; // 1 second delay between batches

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Create viem client for blockchain queries
const client = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL)
});

/**
 * Fetch all created events that need timestamps updated
 */
async function fetchCreatedEvents() {
  console.log('📥 Fetching created events from database...');

  let allEvents = [];
  let start = 0;
  const chunkSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('type', 'created')
      .range(start, start + chunkSize - 1);

    if (error) {
      console.error('❌ Error fetching events:', error);
      throw error;
    }

    if (data.length === 0) break;

    allEvents = allEvents.concat(data);
    console.log(`  Fetched ${allEvents.length} events so far...`);

    if (data.length < chunkSize) break;
    start += chunkSize;
  }

  console.log(`✅ Found ${allEvents.length} created events total\n`);
  return allEvents;
}

/**
 * Fetch transaction and block data from blockchain
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
 * Update events with real blockchain data
 */
async function updateEventTimestamps() {
  console.log('🚀 Starting timestamp update from blockchain...\n');

  const events = await fetchCreatedEvents();

  let successCount = 0;
  let failCount = 0;
  const updates = [];

  console.log(`📊 Processing ${events.length} events in batches of ${BATCH_SIZE}...\n`);

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(events.length / BATCH_SIZE);

    console.log(`🔄 Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, events.length)} of ${events.length})`);

    // Fetch blockchain data for batch
    const results = await Promise.all(
      batch.map(event => getTransactionData(event.txHash))
    );

    // Update events in database
    for (let j = 0; j < batch.length; j++) {
      const event = batch[j];
      const blockData = results[j];

      if (!blockData) {
        console.log(`  ❌ [${i + j + 1}] Failed to fetch: ${event.txHash.substring(0, 10)}...`);
        failCount++;
        continue;
      }

      const { error } = await supabase
        .from('events')
        .update({
          blockNumber: blockData.blockNumber,
          blockHash: blockData.blockHash,
          blockTimestamp: blockData.blockTimestamp,
          txIndex: blockData.txIndex
        })
        .eq('txId', event.txId);

      if (error) {
        console.log(`  ❌ [${i + j + 1}] Update failed: ${event.txHash.substring(0, 10)}...`);
        failCount++;
      } else {
        console.log(`  ✅ [${i + j + 1}] ${event.txHash.substring(0, 10)}... → Block ${blockData.blockNumber} (${blockData.blockTimestamp.toISOString().substring(0, 10)})`);
        successCount++;
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < events.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('\n🎉 Timestamp update complete!');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📊 Total: ${events.length}`);
}

// Run the script
updateEventTimestamps().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
