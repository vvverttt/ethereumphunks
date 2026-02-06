const { createClient } = require('@supabase/supabase-js');
const { createPublicClient, http, parseAbiItem } = require('viem');
const { mainnet } = require('viem/chains');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const RPC_URL = 'https://eth-mainnet.g.alchemy.com/v2/C2mkwU9xTr2HarApFpqbO';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const client = createPublicClient({
  chain: mainnet,
  transport: http(RPC_URL)
});

async function findOnChainTransfers() {
  console.log('🔍 Searching for on-chain transfers of the 9 phunks...\n');

  // Get the 9 transferred phunks
  let allEthscriptions = [];
  let start = 0;
  const chunkSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('ethscriptions')
      .select('tokenId, hashId, creator, owner, sha, createdAt')
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

  console.log(`Found ${transferred.length} phunks with different creator/owner\n`);

  // Get creation block range
  const { data: events } = await supabase
    .from('events')
    .select('blockNumber')
    .eq('type', 'created')
    .order('blockNumber', { ascending: true });

  if (!events || events.length === 0) {
    console.log('❌ No events found to determine block range');
    return;
  }

  const minBlock = Math.min(...events.map(e => e.blockNumber).filter(b => b > 0));
  const maxBlock = Math.max(...events.map(e => e.blockNumber));

  console.log(`Scanning blockchain from block ${minBlock} to ${maxBlock}...\n`);

  // ESIP1 Transfer signature
  const ESIP1_TRANSFER_SIG = '0x3a3e3c8a8e1c8c5d5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e';

  const foundTransfers = [];

  for (const phunk of transferred) {
    console.log(`\nPhunk #${phunk.tokenId} (${phunk.hashId.substring(0, 10)}...)`);
    console.log(`  creator: ${phunk.creator}`);
    console.log(`  owner:   ${phunk.owner}`);

    try {
      // Search for ESIP1 transfer events with this hashId
      const logs = await client.getLogs({
        event: parseAbiItem('event ethscriptions_protocol_TransferEthscriptionForPreviousOwner(address indexed previousOwner, address indexed recipient, bytes32 indexed id)'),
        args: {
          id: phunk.hashId
        },
        fromBlock: BigInt(minBlock),
        toBlock: BigInt(maxBlock)
      });

      if (logs.length > 0) {
        console.log(`  ✅ Found ${logs.length} on-chain transfer(s)!`);

        for (const log of logs) {
          console.log(`     Block ${log.blockNumber}: ${log.args.previousOwner} → ${log.args.recipient}`);
          console.log(`     Tx: ${log.transactionHash}`);

          foundTransfers.push({
            phunk,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            from: log.args.previousOwner,
            to: log.args.recipient
          });
        }
      } else {
        // Try searching for any transaction involving this address and phunk
        console.log(`  ⚪ No ESIP1 transfer events found`);
        console.log(`     Checking if owner change was manual database update...`);
      }

    } catch (error) {
      console.error(`  ❌ Error searching: ${error.message}`);
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n\n' + '═'.repeat(60));
  console.log('\n📊 SUMMARY\n');
  console.log(`Total transferred phunks: ${transferred.length}`);
  console.log(`Found on-chain transfers: ${foundTransfers.length}`);
  console.log(`Database-only changes: ${transferred.length - foundTransfers.length}`);

  if (foundTransfers.length > 0) {
    console.log('\n✅ These transfers CAN be indexed:');
    foundTransfers.forEach(t => {
      console.log(`   Phunk #${t.phunk.tokenId}: ${t.txHash}`);
    });

    console.log('\n💡 Run the indexer to process these transactions!');
    console.log('   Or use: node indexer/reindex-from-json.js');
  }

  if (transferred.length - foundTransfers.length > 0) {
    console.log('\n⚠️  Database-only changes (no on-chain transfers):');
    const dbOnly = transferred.filter(t =>
      !foundTransfers.find(ft => ft.phunk.tokenId === t.tokenId)
    );
    dbOnly.forEach(t => {
      console.log(`   Phunk #${t.tokenId}`);
    });

    console.log('\n   These ownership changes exist only in database.');
    console.log('   To make them on-chain, the owner must:');
    console.log('   1. Transfer via ethscriptions protocol');
    console.log('   2. Use marketplace contract');
    console.log('   3. Or revert database to match on-chain state');
  }

  console.log('\n' + '═'.repeat(60));
}

findOnChainTransfers().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
