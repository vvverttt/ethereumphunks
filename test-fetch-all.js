import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
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
