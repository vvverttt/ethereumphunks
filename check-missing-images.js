import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
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
