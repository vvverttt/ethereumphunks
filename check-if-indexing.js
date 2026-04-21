const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkIndexing() {
  console.log('🔍 Checking if indexer is actively processing...\n');

  // Get last block info
  const { data: config1 } = await supabase
    .from('_global_config')
    .select('lastBlock, updatedAt')
    .eq('network', 1)
    .single();

  if (config1) {
    console.log(`First check - Last Block: ${config1.lastBlock}`);
    console.log(`Time: ${new Date(config1.updatedAt).toISOString()}\n`);
  }

  console.log('Waiting 10 seconds to see if block advances...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  const { data: config2 } = await supabase
    .from('_global_config')
    .select('lastBlock, updatedAt')
    .eq('network', 1)
    .single();

  if (config2) {
    console.log(`Second check - Last Block: ${config2.lastBlock}`);
    console.log(`Time: ${new Date(config2.updatedAt).toISOString()}\n`);

    if (config2.lastBlock > config1.lastBlock) {
      console.log('✅ INDEXER IS ACTIVELY PROCESSING!');
      console.log(`   Advanced by ${config2.lastBlock - config1.lastBlock} blocks in 10 seconds\n`);
    } else {
      console.log('⚠️  Indexer may be idle or caught up to latest block');
      console.log('   Check if there are new blocks to process\n');
    }
  }

  // Check most recent events
  const { data: recentEvents } = await supabase
    .from('events')
    .select('type, blockNumber, blockTimestamp')
    .order('blockTimestamp', { ascending: false })
    .limit(5);

  if (recentEvents && recentEvents.length > 0) {
    console.log('Most recent events:');
    recentEvents.forEach((e, i) => {
      const time = new Date(e.blockTimestamp).toISOString();
      console.log(`   ${i + 1}. ${e.type} - Block ${e.blockNumber} (${time})`);
    });
  }
}

checkIndexing();
