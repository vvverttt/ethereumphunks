const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkSamples() {
  console.log('📊 Checking sample attributes...\n');

  const { data, error } = await supabase
    .from('attributes_new')
    .select('*')
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('Sample attributes_new records:');
  data.forEach((item, i) => {
    console.log(`${i+1}. TokenId ${item.tokenId}, Slug: ${item.slug}`);
    console.log(`   Attributes: ${JSON.stringify(item.values)}`);
  });

  // Check what's indexed
  console.log('\n📊 Checking indexed ethscriptions...\n');
  const { data: indexedData, error: indexedError } = await supabase
    .from('ethscriptions')
    .select('tokenId, slug, sha')
    .eq('slug', 'cryptophunksv67')
    .order('tokenId', { ascending: true })
    .limit(10);

  if (!indexedError && indexedData) {
    console.log('Sample indexed ethscriptions:');
    indexedData.forEach((item, i) => {
      console.log(`${i+1}. TokenId ${item.tokenId}, SHA: ${item.sha.substring(0, 16)}...`);
    });

    console.log('\n📊 Checking range of indexed tokenIds...');
    const { data: rangeData } = await supabase
      .from('ethscriptions')
      .select('tokenId')
      .eq('slug', 'cryptophunksv67')
      .order('tokenId', { ascending: false })
      .limit(1);

    if (rangeData && rangeData.length > 0) {
      console.log(`Highest tokenId indexed: ${rangeData[0].tokenId}`);
    }
  }
}

checkSamples().catch(console.error);
