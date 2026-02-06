import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function testRangeFix() {
  const walletAddress = '0xea04f65f9dc5917302532859d80fcf36a15de266';

  console.log('🧪 Testing RPC with .range(0, 9999) fix...\n');

  // Test WITH .range()
  const { data, error } = await supabase.rpc(
    'fetch_ethscriptions_owned_with_listings_and_bids',
    {
      address: walletAddress,
      collection_slug: 'cryptophunksv67',
      max_results: 10000
    }
  ).range(0, 9999);

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log(`✅ RPC returned: ${data?.length || 0} items`);

    if (data.length >= 4266) {
      console.log('🎉 SUCCESS! Now returning all 4266 items!');
    } else {
      console.log(`⚠️  Still only returning ${data.length} items (expected 4266)`);
    }
  }
}

testRangeFix().catch(console.error);
