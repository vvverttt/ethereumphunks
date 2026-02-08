const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkStatus() {
  console.log('📊 Checking Ethereum Phunks collection indexing status...\n');

  // Get total count
  const { count: totalCount, error: totalError } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('slug', 'ethereumphunks');

  if (totalError) {
    console.error('❌ Error getting total count:', totalError);
    return;
  }

  console.log(`✅ Total Ethereum Phunks indexed: ${totalCount}`);
  console.log(`   Expected: 4337`);
  console.log(`   Missing: ${4337 - totalCount}`);

  // Check for the corrupted hash
  const { data: corruptedData, error: corruptedError } = await supabase
    .from('ethscriptions')
    .select('tokenId, hashId')
    .eq('tokenId', '8162')
    .eq('slug', 'cryptophunksv67');

  if (!corruptedError && corruptedData && corruptedData.length > 0) {
    console.log('\n📋 Corrupted hash (tokenId 8162):');
    console.log(`   Hash: ${corruptedData[0].hashId}`);
    console.log(`   Status: Present in database (will show consensus issue)`);
  }

  // Get recent ethscriptions
  const { data: recentData, error: recentError } = await supabase
    .from('ethscriptions')
    .select('tokenId, hashId, createdAt')
    .eq('slug', 'ethereumphunks')
    .order('createdAt', { ascending: false })
    .limit(5);

  if (!recentError && recentData) {
    console.log('\n🕒 Most recently indexed items:');
    recentData.forEach((item, i) => {
      console.log(`   ${i + 1}. TokenId ${item.tokenId} at ${item.createdAt}`);
    });
  }

  // Check if any are missing metadata
  const { count: missingMetadata, error: metadataError } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('slug', 'ethereumphunks')
    .is('imageData', null);

  if (!metadataError) {
    console.log(`\n🖼️  Items missing image data: ${missingMetadata}`);
  }
}

checkStatus().catch(console.error);
