import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function check() {
  // Check owned items count directly
  const { data: owned, error: ownedError } = await supabase
    .from('ethscriptions')
    .select('tokenId')
    .eq('slug', 'cryptophunksv67')
    .eq('owner', '0xea04f65f9dc5917302532859d80fcf36a15de266')
    .limit(10);

  console.log('Direct query - Owned items sample:', owned?.length || 0);
  if (ownedError) console.log('Error:', ownedError);

  // Check token 5637 attributes
  const { data: token5637 } = await supabase
    .from('ethscriptions')
    .select('tokenId, hashId')
    .eq('slug', 'cryptophunksv67')
    .eq('tokenId', 5637)
    .single();

  console.log('\nToken 5637:', token5637);

  // Check attributes for token 5637
  const { data: attrs } = await supabase
    .from('attributes_new')
    .select('*')
    .eq('hashId', token5637?.hashId);

  console.log('Token 5637 attributes:', attrs);

  // Check how many One of One attributes exist
  const { data: oneOfOne } = await supabase
    .from('attributes_new')
    .select('hashId')
    .eq('slug', 'cryptophunksv67')
    .eq('trait_type', 'Type')
    .eq('value', 'One Of One');

  console.log('\nTotal "One Of One" attributes:', oneOfOne?.length || 0);

  // Check if RPC function works
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'fetch_ethscriptions_owned_with_listings_and_bids',
    {
      address: '0xea04f65f9dc5917302532859d80fcf36a15de266',
      collection_slug: 'cryptophunksv67'
    }
  );

  console.log('\nRPC function result:', rpcResult?.length || 0, 'items');
  if (rpcError) console.log('RPC Error:', rpcError);
}

check().catch(console.error);
