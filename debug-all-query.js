import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function debugAllQuery() {
  console.log('🔍 Testing fetch_all_with_pagination_new query...\n');

  // Test with same parameters frontend would use
  const { data, error } = await supabase.rpc('fetch_all_with_pagination_new', {
    p_slug: 'cryptophunksv67',
    p_from_num: 0,
    p_to_num: 100,
    p_filters: {}
  });

  if (error) {
    console.log('❌ Error:', error);
    return;
  }

  console.log('✅ Query successful!');
  console.log('\n📊 Response:');
  console.log('   Total count:', data.total_count);
  console.log('   Data items returned:', data.data?.length || 0);

  if (data.data && data.data.length > 0) {
    console.log('\n📋 First 3 items:');
    data.data.slice(0, 3).forEach((item, i) => {
      console.log(`\n   Item ${i + 1}:`);
      console.log(`   - tokenId: ${item.tokenId}`);
      console.log(`   - sha: ${item.sha}`);
      console.log(`   - hashId: ${item.hashId}`);
      console.log(`   - slug: ${item.slug}`);
      console.log(`   - listing: ${item.listing}`);
    });
  } else {
    console.log('\n❌ No data items returned!');
  }

  // Also test direct ethscriptions query
  console.log('\n\n🔍 Testing direct ethscriptions query...');
  const { data: directData, error: directError } = await supabase
    .from('ethscriptions')
    .select('tokenId, sha, hashId, slug')
    .eq('slug', 'cryptophunksv67')
    .order('tokenId', { ascending: true })
    .range(0, 5);

  if (directError) {
    console.log('❌ Error:', directError);
  } else {
    console.log(`✅ Direct query returned ${directData.length} items`);
    if (directData.length > 0) {
      console.log('   First item:', directData[0]);
    }
  }
}

debugAllQuery().catch(console.error);
