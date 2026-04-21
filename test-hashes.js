import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function test() {
  // Get 10 sample hashes from different points
  const { data } = await supabase
    .from('ethscriptions')
    .select('hashId, tokenId')
    .eq('slug', 'cryptophunksv67')
    .in('tokenId', [1, 10, 100, 500, 1000, 2000, 3000, 4000, 4337]);

  console.log(`Testing ${data.length} sample transaction hashes:\n`);

  let found = 0;
  let notFound = 0;

  for (const item of data) {
    const response = await fetch(`https://api.ethscriptions.com/v2/ethscriptions/${item.hashId}`);

    if (response.ok) {
      found++;
      const result = await response.json();
      console.log(`✅ Token #${item.tokenId}: FOUND - Owner: ${result.current_owner}`);
    } else {
      notFound++;
      console.log(`❌ Token #${item.tokenId}: NOT FOUND (${response.status})`);
      console.log(`   Hash: ${item.hashId}`);
    }
  }

  console.log(`\n📊 Results: ${found} found, ${notFound} not found`);
}

test().catch(console.error);
