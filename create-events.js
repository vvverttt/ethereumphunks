const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const JSON_FILE_PATH = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\cryptophunks-v67.json';
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const BATCH_SIZE = 100; // Insert in batches

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

/**
 * Read ethscription data from JSON file
 */
function readEthscriptionData() {
  console.log('📥 Reading ethscription data from JSON file...');

  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf8'));

  if (!jsonData.collection_items || !Array.isArray(jsonData.collection_items)) {
    throw new Error('Invalid JSON structure: collection_items not found');
  }

  console.log(`✅ Found ${jsonData.collection_items.length} ethscriptions`);
  return jsonData.collection_items;
}

/**
 * Get ethscription details from database to match with JSON data
 */
async function getEthscriptionsFromDb() {
  console.log('📥 Fetching ethscriptions from database...');

  // Fetch in chunks to bypass 1000 limit
  let allData = [];
  let start = 0;
  const chunkSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('ethscriptions')
      .select('*')
      .eq('slug', 'cryptophunksv67')
      .range(start, start + chunkSize - 1);

    if (error) {
      console.error('❌ Error fetching ethscriptions:', error);
      throw error;
    }

    if (data.length === 0) break;

    allData = allData.concat(data);
    console.log(`  Fetched ${allData.length} so far...`);

    if (data.length < chunkSize) break;
    start += chunkSize;
  }

  console.log(`✅ Found ${allData.length} ethscriptions in database total`);

  // Create a map by sha for quick lookup
  const ethscriptionMap = new Map();
  allData.forEach(eth => {
    ethscriptionMap.set(eth.sha, eth);
  });

  return ethscriptionMap;
}

/**
 * Create events for ethscriptions
 */
async function createEvents() {
  console.log('🚀 Starting creation event population...\n');

  const jsonItems = readEthscriptionData();
  const dbEthscriptions = await getEthscriptionsFromDb();

  const events = [];

  for (const item of jsonItems) {
    const dbEth = dbEthscriptions.get(item.sha);

    if (!dbEth) {
      console.log(`⚠️  No database entry found for SHA: ${item.sha}`);
      continue;
    }

    // Create a "created" event (matching events table schema)
    const event = {
      type: 'created',
      hashId: dbEth.hashId,
      txHash: item.id, // Transaction hash from JSON
      txId: item.id + '-0-0', // Construct a unique txId
      from: dbEth.creator,
      to: dbEth.creator,
      blockNumber: 0, // Placeholder
      blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder
      blockTimestamp: new Date(item.created_at || dbEth.createdAt),
      txIndex: 0,
      value: '0',
    };

    events.push(event);
  }

  console.log(`\n📊 Created ${events.length} events to insert\n`);

  // Insert in batches
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(events.length / BATCH_SIZE);

    console.log(`🔄 Inserting batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, events.length)} of ${events.length})`);

    const { data, error } = await supabase
      .from('events')
      .insert(batch);

    if (error) {
      console.log(`  ❌ Batch ${batchNum} failed:`, error.message);
      failCount += batch.length;
    } else {
      console.log(`  ✅ Batch ${batchNum} inserted successfully`);
      successCount += batch.length;
    }
  }

  console.log('\n🎉 Event creation complete!');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📊 Total: ${events.length}`);
}

// Run the script
createEvents().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
