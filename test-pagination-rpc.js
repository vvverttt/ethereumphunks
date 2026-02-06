const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function testPaginationRPC() {
  console.log('🔍 Testing fetch_all_with_pagination_new RPC...\n');

  const { data, error } = await supabase.rpc('fetch_all_with_pagination_new', {
    p_slug: 'cryptophunksv67',
    p_from_num: 0,
    p_to_num: 10000,
    p_filters: {}
  });

  if (error) {
    console.error('❌ RPC Error:', error);
    return;
  }

  console.log(`✅ RPC Success!`);
  console.log(`   Returned: ${data?.data?.length || 0} phunks`);
  console.log(`   Total count: ${data?.total_count || 0}\n`);

  if (data?.data && data.data.length > 0) {
    const tokenIds = data.data.map(p => p.tokenId).sort((a, b) => a - b);
    console.log(`TokenId range: #${tokenIds[0]} to #${tokenIds[tokenIds.length - 1]}`);

    // Check if phunks > 10207 are included
    const after10207 = tokenIds.filter(id => id > 10207);
    console.log(`Phunks after #10207: ${after10207.length}`);

    if (after10207.length > 0) {
      console.log(`   Highest: #${Math.max(...after10207)}`);
      console.log(`   Examples: ${after10207.slice(0, 5).join(', ')}`);
    }
  }

  // Test with specific range to see phunks 10200-10320
  console.log('\n\n🔍 Testing specific range (10200-10320)...\n');

  const { data: rangeData, error: rangeError } = await supabase.rpc('fetch_all_with_pagination_new', {
    p_slug: 'cryptophunksv67',
    p_from_num: 4300,
    p_to_num: 4400,
    p_filters: {}
  });

  if (rangeError) {
    console.error('❌ Error:', rangeError);
  } else {
    console.log(`Returned: ${rangeData?.data?.length || 0} phunks in range`);
    if (rangeData?.data && rangeData.data.length > 0) {
      const ids = rangeData.data.map(p => p.tokenId).sort((a, b) => a - b);
      console.log(`TokenIds: ${ids.slice(0, 10).join(', ')}${ids.length > 10 ? '...' : ''}`);
    }
  }
}

testPaginationRPC();
