const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function main() {
  // Fix supply from 106 to 105
  console.log('Updating ethsrock supply from 106 to 105...');
  const { error } = await supabase
    .from('collections')
    .update({ supply: 105 })
    .eq('slug', 'ethsrock');

  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Supply updated to 105');

  // Check current events for ethsrock
  console.log('\nChecking events for ethsrock items...');
  const { data: ethsrockItems, error: itemsError } = await supabase
    .from('ethscriptions')
    .select('hashId')
    .eq('slug', 'ethsrock');

  if (itemsError) {
    console.error('Error fetching items:', itemsError);
    return;
  }

  console.log('Ethsrock items in ethscriptions table:', ethsrockItems.length);

  const hashIds = ethsrockItems.map(i => i.hashId);

  // Check events for these hashIds
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .in('hashId', hashIds);

  if (eventsError) {
    console.error('Error fetching events:', eventsError);
    return;
  }

  console.log('Total events found for ethsrock:', events.length);

  // Count by type
  const typeCounts = {};
  events.forEach(e => {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  });
  console.log('Events by type:', typeCounts);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
