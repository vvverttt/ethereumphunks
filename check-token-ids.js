import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function checkTokenIds() {
  const failedTokens = [5865, 6850, 6922, 6996, 8913];

  console.log('🔍 Checking if these token IDs exist in database...\n');

  for (const tokenId of failedTokens) {
    const { data, error } = await supabase
      .from('ethscriptions')
      .select('tokenId, hashId, sha')
      .eq('slug', 'cryptophunksv67')
      .eq('tokenId', tokenId)
      .single();

    if (data) {
      console.log(`✅ Token #${tokenId} EXISTS in database`);
      console.log(`   Hash: ${data.hashId.substring(0, 20)}...`);
      console.log(`   SHA: ${data.sha.substring(0, 20)}...`);
    } else {
      console.log(`❌ Token #${tokenId} NOT in database`);
    }
  }

  // Check total count and max tokenId
  const { count } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('slug', 'cryptophunksv67');

  const { data: maxToken } = await supabase
    .from('ethscriptions')
    .select('tokenId')
    .eq('slug', 'cryptophunksv67')
    .order('tokenId', { ascending: false })
    .limit(1)
    .single();

  console.log(`\n📊 Total: ${count} items`);
  console.log(`📊 Max tokenId: ${maxToken?.tokenId}`);
}

checkTokenIds().catch(console.error);
