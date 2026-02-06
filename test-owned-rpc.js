import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function testOwnedRPC() {
  console.log('🧪 Testing fetch_ethscriptions_owned_with_listings_and_bids RPC...\n');

  const testAddress = '0xd9d6ea781c6b412a4dac36e39ca7e29c9cdbea1d'; // Replace with actual wallet address

  console.log(`Testing with address: ${testAddress}\n`);

  // Test WITHOUT max_results (should default to 10000)
  console.log('📊 Test 1: With max_results=10000');
  const { data: data1, error: error1 } = await supabase.rpc(
    'fetch_ethscriptions_owned_with_listings_and_bids',
    {
      address: testAddress,
      collection_slug: 'cryptophunksv67',
      max_results: 10000
    }
  );

  if (error1) {
    console.log('❌ Error:', error1.message);
  } else {
    console.log(`   Returned ${data1?.length || 0} items`);
  }

  // Test without max_results to see default
  console.log('\n📊 Test 2: WITHOUT max_results parameter');
  const { data: data2, error: error2 } = await supabase.rpc(
    'fetch_ethscriptions_owned_with_listings_and_bids',
    {
      address: testAddress,
      collection_slug: 'cryptophunksv67'
    }
  );

  if (error2) {
    console.log('❌ Error:', error2.message);
  } else {
    console.log(`   Returned ${data2?.length || 0} items (default limit)`);
  }

  // Get total owned from database directly
  console.log('\n📊 Test 3: Direct count from database');
  const { count } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('slug', 'cryptophunksv67')
    .eq('owner', testAddress.toLowerCase());

  console.log(`   Total owned in database: ${count}`);

  console.log('\n💡 If Test 1 returns less than Test 3, there may be a PostgREST limit.');
}

testOwnedRPC().catch(console.error);
