const { createClient } = require('@supabase/supabase-js');
const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';
const RPC_URL = 'https://eth-mainnet.g.alchemy.com/v2/C2mkwU9xTr2HarApFpqbO';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const client = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL)
});

async function checkIndexerStatus() {
  console.log('🔍 Checking indexer status...\n');

  // Get current blockchain block
  const currentBlock = await client.getBlockNumber();
  console.log(`Current Blockchain Block: ${currentBlock}`);

  // Get last indexed block
  const { data: globalConfig } = await supabase
    .from('_global_config')
    .select('*')
    .eq('network', 1)
    .single();

  if (globalConfig) {
    const lastBlock = globalConfig.lastBlock;
    const blocksBehind = Number(currentBlock) - lastBlock;

    console.log(`Last Indexed Block: ${lastBlock}`);
    console.log(`Blocks Behind: ${blocksBehind}`);

    if (blocksBehind > 100) {
      console.log(`⚠️  Indexer is ${blocksBehind} blocks behind!`);
    } else if (blocksBehind > 10) {
      console.log(`✅ Indexer is catching up (${blocksBehind} blocks behind)`);
    } else {
      console.log(`✅ Indexer is up to date!`);
    }
  }

  // Check recent events
  console.log('\n\n📊 Recent On-Chain Events:\n');

  const { data: recentEvents } = await supabase
    .from('events')
    .select('type, blockNumber, blockTimestamp, txHash, hashId')
    .order('blockTimestamp', { ascending: false })
    .limit(10);

  if (recentEvents && recentEvents.length > 0) {
    console.log('Last 10 events indexed:');
    recentEvents.forEach((e, idx) => {
      console.log(`  ${idx + 1}. ${e.type} - Block ${e.blockNumber} (${new Date(e.blockTimestamp).toISOString().substring(0, 16)})`);
    });
  } else {
    console.log('No events found');
  }

  // Check for marketplace activity
  console.log('\n\n📊 Checking for marketplace events on-chain...\n');

  const MARKET_ADDRESS = '0xD3418772623Be1a3cc6B6D45CB46420CEdD9154a';

  // Get earliest phunk creation block
  const { data: earliestEvent } = await supabase
    .from('events')
    .select('blockNumber')
    .eq('type', 'created')
    .order('blockNumber', { ascending: true })
    .limit(1)
    .single();

  if (earliestEvent) {
    const fromBlock = BigInt(earliestEvent.blockNumber);
    console.log(`Scanning marketplace from block ${fromBlock} to latest...\n`);

    try {
      // Check for any marketplace events for our collection
      const { parseAbiItem } = require('viem');

      const offeredLogs = await client.getLogs({
        address: MARKET_ADDRESS,
        event: parseAbiItem('event PhunkOffered(bytes32 indexed phunkId, address indexed toAddress, uint256 minValue)'),
        fromBlock,
        toBlock: 'latest'
      });

      const boughtLogs = await client.getLogs({
        address: MARKET_ADDRESS,
        event: parseAbiItem('event PhunkBought(bytes32 indexed phunkId, address indexed fromAddress, address indexed toAddress, uint256 value)'),
        fromBlock,
        toBlock: 'latest'
      });

      console.log(`Found on blockchain:`);
      console.log(`  PhunkOffered events: ${offeredLogs.length}`);
      console.log(`  PhunkBought events: ${boughtLogs.length}`);

      // Check what's in database
      const { data: dbOffered } = await supabase
        .from('events')
        .select('txHash')
        .eq('type', 'PhunkOffered');

      const { data: dbBought } = await supabase
        .from('events')
        .select('txHash')
        .eq('type', 'PhunkBought');

      console.log(`\nIn database:`);
      console.log(`  PhunkOffered events: ${dbOffered?.length || 0}`);
      console.log(`  PhunkBought events: ${dbBought?.length || 0}`);

      if (offeredLogs.length > (dbOffered?.length || 0) || boughtLogs.length > (dbBought?.length || 0)) {
        console.log('\n⚠️  Missing marketplace events! Indexer needs to catch up.');
      } else {
        console.log('\n✅ Marketplace events are up to date');
      }

    } catch (error) {
      console.error('❌ Error checking marketplace:', error.message);
    }
  }

  // Check if indexer is actively processing
  console.log('\n\n🔍 Checking if indexer is actively processing...\n');

  const { data: veryRecentEvents } = await supabase
    .from('events')
    .select('blockTimestamp')
    .order('blockTimestamp', { ascending: false })
    .limit(1)
    .single();

  if (veryRecentEvents) {
    const lastEventTime = new Date(veryRecentEvents.blockTimestamp);
    const now = new Date();
    const minutesAgo = Math.floor((now - lastEventTime) / 1000 / 60);

    console.log(`Last event indexed: ${lastEventTime.toISOString()}`);
    console.log(`That was ${minutesAgo} minutes ago`);

    if (minutesAgo < 5) {
      console.log('✅ Indexer is actively processing!');
    } else if (minutesAgo < 60) {
      console.log('⚠️  Indexer may be idle or slow');
    } else {
      console.log('❌ Indexer appears to be stopped!');
    }
  }
}

checkIndexerStatus();
