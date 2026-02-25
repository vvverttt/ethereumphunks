const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function main() {
  const hashId = '0x92aede6364e1cec7b1dac431c6172566b69799d05566bb11df933ced552c3cb1';

  // 1. Check events in DB for this item
  const { data: dbEvents } = await sb.from('events')
    .select('type,from,to,blockTimestamp,blockNumber')
    .eq('hashId', hashId)
    .order('blockNumber', { ascending: false });

  console.log('=== Events in DB ===');
  (dbEvents || []).forEach(e => {
    console.log(`  ${e.type} | block ${e.blockNumber} | to: ${e.to}`);
  });

  // 2. Get item slug
  const { data: item } = await sb.from('ethscriptions')
    .select('slug,tokenId')
    .eq('hashId', hashId)
    .single();

  console.log('\nItem:', item?.slug, '#' + item?.tokenId);

  // 3. Call fetch_events RPC like the Recent Activity does
  const { data: rpcEvents, error } = await sb.rpc('fetch_events', {
    p_limit: 20,
    p_type: null,
    p_collection_slug: item?.slug || 'og-missing-phunks',
    p_offset: 0,
  });

  if (error) {
    console.log('\nRPC error:', error.message);
  }

  console.log('\n=== Recent Activity RPC results (first 10) ===');
  const events = Array.isArray(rpcEvents) ? rpcEvents : [];
  const matching = events.filter(e => e.hashId === hashId);
  console.log('Total events returned:', events.length);
  console.log('Events for this item:', matching.length);
  matching.forEach(e => {
    console.log(`  ${e.type} | to: ${e.to}`);
  });

  // Check if ANY transfer events to market addresses are in the results
  const escrowTransfers = events.filter(e =>
    e.type === 'transfer' && (
      e.to === '0xa48a43186612b179c0bc68ea34b4932549a70bfa' ||
      e.to === '0xd3418772623be1a3cc6b6d45cb46420cedd9154a'
    )
  );
  console.log('\nEscrow transfers in results:', escrowTransfers.length);
}

main().catch(console.error);
