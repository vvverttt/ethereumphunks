const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function main() {
  console.log('🔍 Checking failed event and transfers...\n');

  // Find the failed event
  const failedTxHash = '0x7ab93e24';
  const { data: failedEvent } = await supabase
    .from('events')
    .select('*')
    .ilike('txHash', `${failedTxHash}%`)
    .eq('type', 'created')
    .limit(1);

  if (failedEvent && failedEvent.length > 0) {
    console.log('❌ Failed Event:');
    console.log(`   txHash: ${failedEvent[0].txHash}`);
    console.log(`   hashId: ${failedEvent[0].hashId}`);
    console.log(`   blockTimestamp: ${failedEvent[0].blockTimestamp}`);

    // Get the ethscription details
    const { data: ethscription } = await supabase
      .from('ethscriptions')
      .select('tokenId, sha')
      .eq('hashId', failedEvent[0].hashId)
      .single();

    if (ethscription) {
      console.log(`   tokenId: ${ethscription.tokenId}`);
      console.log(`   Issue: Malformed transaction hash (has double 0x)\n`);
    }
  }

  // Get transferred ethscriptions with tokenIds
  console.log('📊 Transferred Ethscriptions:\n');

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

  console.log(`Found ${transferred.length} transferred ethscriptions:\n`);

  transferred.forEach((e, idx) => {
    console.log(`${idx + 1}. Phunk #${e.tokenId}`);
    console.log(`   hashId: ${e.hashId}`);
    console.log(`   creator: ${e.creator}`);
    console.log(`   owner: ${e.owner}\n`);
  });

  if (transferred.length > 0) {
    console.log(`✅ Try viewing Phunk #${transferred[0].tokenId} to see if it has transfer history`);
  }

  // Check Recent Activity events
  console.log('\n\n📊 Checking Recent Activity events...\n');

  const { data: recentEvents, error } = await supabase
    .from('events')
    .select(`
      *,
      ethscriptions(tokenId,slug)
    `)
    .eq('ethscriptions.slug', 'cryptophunksv67')
    .order('blockTimestamp', { ascending: true })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching recent events:', error);
  } else {
    console.log(`Found ${recentEvents?.length || 0} events in Recent Activity query`);

    if (recentEvents && recentEvents.length > 0) {
      console.log('\nSample events:');
      recentEvents.slice(0, 3).forEach((e, idx) => {
        console.log(`  ${idx + 1}. Type: ${e.type}, Phunk #${e.ethscriptions?.tokenId}, ${new Date(e.blockTimestamp).toISOString().substring(0, 10)}`);
      });
    }
  }

  // Check if RPC function works
  console.log('\n\n🔍 Testing fetch_events RPC function...\n');

  try {
    const { data: rpcEvents, error: rpcError } = await supabase.rpc('fetch_events', {
      p_limit: 10,
      p_collection_slug: 'cryptophunksv67',
      p_type: null,
      p_offset: 0
    });

    if (rpcError) {
      console.error('❌ RPC Error:', rpcError);
    } else {
      console.log(`✅ RPC returned ${rpcEvents?.length || 0} events`);

      if (rpcEvents && rpcEvents.length > 0) {
        console.log('\nSample RPC events:');
        rpcEvents.slice(0, 3).forEach((e, idx) => {
          console.log(`  ${idx + 1}. Type: ${e.type}, Phunk #${e.tokenId}, ${new Date(e.blockTimestamp).toISOString().substring(0, 10)}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ RPC call failed:', error.message);
  }
}

main();
