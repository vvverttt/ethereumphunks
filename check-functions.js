import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function checkFunctions() {
  console.log('🔍 Checking which RPC functions exist...\n');

  const functionsToTest = [
    'fetch_events',
    'fetch_all_with_pagination_new',
    'fetch_ethscriptions_with_listings_and_bids',
    'fetch_ethscriptions_owned_with_listings_and_bids',
    'fetch_collections_with_previews'
  ];

  for (const fn of functionsToTest) {
    try {
      const { error } = await supabase.rpc(fn, {});
      if (error) {
        if (error.message.includes('Could not find')) {
          console.log(`❌ ${fn} - NOT FOUND`);
        } else {
          console.log(`✅ ${fn} - EXISTS (error expected with no params)`);
        }
      } else {
        console.log(`✅ ${fn} - EXISTS`);
      }
    } catch (err) {
      console.log(`❌ ${fn} - ERROR: ${err.message}`);
    }
  }
}

checkFunctions().catch(console.error);
