import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function testFilterCount() {
  console.log('🧪 Testing filtered count with One of One filter...\n');

  const { data, error } = await supabase.rpc(
    'fetch_all_with_pagination_new',
    {
      p_slug: 'cryptophunksv67',
      p_from_num: 0,
      p_to_num: 10000,
      p_filters: { Special: 'One of One' }
    }
  );

  if (error) {
    console.log('❌ Error:', error);
  } else {
    console.log('✅ Result:');
    console.log('  - Data length:', data?.data?.length || 0);
    console.log('  - Total count:', data?.total || 0);
    console.log('  - First few items:', data?.data?.slice(0, 3).map(p => `#${p.tokenId}`));
  }
}

testFilterCount().catch(console.error);
