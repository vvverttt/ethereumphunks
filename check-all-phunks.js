const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkAllPhunks() {
  console.log('🔍 Checking all phunks in database...\n');

  // Count total
  const { count: total } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('slug', 'cryptophunksv67');

  console.log(`Total phunks in database: ${total}\n`);

  // Get min and max tokenId
  const { data: minMax } = await supabase
    .from('ethscriptions')
    .select('tokenId')
    .eq('slug', 'cryptophunksv67')
    .order('tokenId', { ascending: true })
    .limit(1);

  const { data: maxData } = await supabase
    .from('ethscriptions')
    .select('tokenId')
    .eq('slug', 'cryptophunksv67')
    .order('tokenId', { ascending: false })
    .limit(1);

  if (minMax && minMax.length > 0 && maxData && maxData.length > 0) {
    console.log(`TokenId range: #${minMax[0].tokenId} to #${maxData[0].tokenId}\n`);
  }

  // Check for gaps in tokenIds
  console.log('Checking for missing tokenIds...\n');

  const { data: allTokenIds } = await supabase
    .from('ethscriptions')
    .select('tokenId')
    .eq('slug', 'cryptophunksv67')
    .order('tokenId', { ascending: true })
    .limit(10000);

  if (allTokenIds && allTokenIds.length > 0) {
    const ids = allTokenIds.map(p => p.tokenId).sort((a, b) => a - b);
    const missing = [];

    for (let i = ids[0]; i <= ids[ids.length - 1]; i++) {
      if (!ids.includes(i)) {
        missing.push(i);
      }
    }

    if (missing.length > 0) {
      console.log(`⚠️  Missing tokenIds: ${missing.length}`);
      console.log(`   Examples: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}\n`);
    } else {
      console.log(`✅ No missing tokenIds in range!\n`);
    }
  }

  // Check phunks around #10207
  console.log('Checking phunks around #10207...\n');

  const { data: around10207 } = await supabase
    .from('ethscriptions')
    .select('tokenId, hashId')
    .eq('slug', 'cryptophunksv67')
    .gte('tokenId', 10200)
    .lte('tokenId', 10220)
    .order('tokenId', { ascending: true });

  if (around10207) {
    console.log('Phunks from #10200 to #10220:');
    around10207.forEach(p => {
      console.log(`   #${p.tokenId}: ${p.hashId.substring(0, 10)}...`);
    });
  }

  // Test the RPC function that the frontend uses
  console.log('\n\n🔍 Testing frontend RPC function...\n');

  const { data: rpcData, error: rpcError } = await supabase.rpc('fetch_ethscriptions_with_pagination', {
    p_slug: 'cryptophunksv67',
    p_offset: 0,
    p_length: 10000,
    p_trait_filters: {}
  });

  if (rpcError) {
    console.error('❌ RPC Error:', rpcError);
  } else {
    console.log(`RPC returned ${rpcData?.data?.length || 0} phunks`);
    console.log(`Total count: ${rpcData?.total_count || 0}`);

    if (rpcData?.data && rpcData.data.length > 0) {
      const rpcIds = rpcData.data.map(p => p.tokenId).sort((a, b) => a - b);
      console.log(`TokenId range in RPC: #${rpcIds[0]} to #${rpcIds[rpcIds.length - 1]}`);
    }
  }
}

checkAllPhunks();
