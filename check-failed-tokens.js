import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function checkFailedTokens() {
  const { data: tokens } = await supabase
    .from('ethscriptions')
    .select('tokenId, hashId, sha')
    .eq('slug', 'cryptophunksv67')
    .in('tokenId', [1970, 4847, 6000]);

  console.log('Checking failed tokens in Ethscriptions API:\n');

  for (const token of tokens) {
    console.log(`Token #${token.tokenId}:`);
    console.log(`  DB hashId: ${token.hashId}`);
    console.log(`  DB sha: ${token.sha}`);

    // Try searching by SHA in the API
    try {
      const response = await fetch(`https://api.ethscriptions.com/v2/ethscriptions?sha=${token.sha}`);
      const data = await response.json();

      if (data.result && data.result.length > 0) {
        const ethscription = data.result[0];
        console.log(`  ✅ Found in API!`);
        console.log(`  API hashId: ${ethscription.transaction_hash}`);
        console.log(`  Owner: ${ethscription.current_owner}`);
        console.log(`  Creator: ${ethscription.creator}`);

        if (ethscription.transaction_hash !== token.hashId) {
          console.log(`  ⚠️  HashId mismatch! Need to update database.`);
        }
      } else {
        console.log(`  ❌ Not found in API by SHA`);
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
    }

    console.log('');
  }
}

checkFailedTokens().catch(console.error);
