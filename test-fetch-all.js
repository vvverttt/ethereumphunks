import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function testFetchAll() {
  console.log('🔍 Testing fetch_all_with_pagination_new function...\n');

  const { data, error } = await supabase.rpc('fetch_all_with_pagination_new', {
    p_slug: 'cryptophunksv67',
    p_from_num: 0,
    p_to_num: 10,
    p_filters: {}
  });

  if (error) {
    console.log('❌ Error:', error);
    return;
  }

  console.log('✅ Success!');
  console.log('Total count:', data.total_count);
  console.log('Returned items:', data.data?.length || 0);

  if (data.data && data.data.length > 0) {
    console.log('\nFirst item:');
    console.log(JSON.stringify(data.data[0], null, 2));
  }
}

testFetchAll();
