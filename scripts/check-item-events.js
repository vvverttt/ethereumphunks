const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function main() {
  const hashId = '0x396236ea4c958d9d36e8a17ddb08f2d17c6b554b09c5d81e772957ef603004a0';

  const { data: item } = await sb.from('ethscriptions')
    .select('hashId,tokenId,slug,owner,prevOwner,creator')
    .eq('hashId', hashId)
    .single();
  console.log('Item:', JSON.stringify(item, null, 2));

  const { data: events } = await sb.from('events')
    .select('type,from,to,value,blockTimestamp,blockNumber')
    .eq('hashId', hashId)
    .order('blockNumber', { ascending: true });

  console.log('\nEvents (' + (events || []).length + '):');
  (events || []).forEach(e => {
    console.log('  ' + e.blockNumber + ' | ' + e.type + ' | ' + (e.blockTimestamp || '').slice(0, 19));
    console.log('    from:', e.from, ' to:', e.to);
    if (e.value !== '0') console.log('    value:', e.value);
  });

  const { data: listing } = await sb.from('listings').select('*').eq('hashId', hashId);
  console.log('\nListings:', JSON.stringify(listing, null, 2));
}

main().catch(console.error);
