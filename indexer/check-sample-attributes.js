const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

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
