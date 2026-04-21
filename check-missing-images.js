import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

const failedTokens = [5865, 6850, 6922, 6996, 8913];

async function checkMissing() {
  console.log('🔍 Checking missing images...\n');

  for (const tokenId of failedTokens) {
    // Check if file exists in mint-images bucket
    const { data, error } = await supabase.storage
      .from('mint-images')
      .download(`cryptophunksv67/${tokenId}.png`);

    if (error) {
      console.log(`❌ Token #${tokenId}: NOT in mint-images (${error.message})`);

      // Get the sha for this token to check if we can create it
      const { data: ethData } = await supabase
        .from('ethscriptions')
        .select('sha')
        .eq('slug', 'cryptophunksv67')
        .eq('tokenId', tokenId)
        .single();

      if (ethData) {
        console.log(`   SHA: ${ethData.sha}`);
      }
    } else {
      console.log(`✅ Token #${tokenId}: EXISTS in mint-images`);
    }
  }
}

checkMissing().catch(console.error);
