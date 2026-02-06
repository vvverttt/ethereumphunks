import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
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
