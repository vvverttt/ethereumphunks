const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkAllEventTypes() {
  console.log('📊 Checking ALL event types in database...\n');

  // Count each event type
  const eventTypes = ['created', 'transfer', 'PhunkOffered', 'PhunkBought', 'PhunkNoLongerForSale', 'PhunkBidEntered', 'PhunkBidWithdrawn'];

  for (const type of eventTypes) {
    const { count } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('type', type);

    console.log(`${type}: ${count || 0}`);

    if (count > 0) {
      const { data: sample } = await supabase
        .from('events')
        .select('*')
        .eq('type', type)
        .limit(1);

      if (sample && sample.length > 0) {
        console.log(`  Sample: hashId=${sample[0].hashId}, from=${sample[0].from}, to=${sample[0].to}`);
      }
    }
  }

  // Check ethscriptions that might have been transferred
  console.log('\n📊 Checking ethscriptions for potential transfers...\n');

  let allEthscriptions = [];
  let start = 0;
  const chunkSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('ethscriptions')
      .select('hashId, creator, owner, slug')
      .eq('slug', 'cryptophunksv67')
      .range(start, start + chunkSize - 1);

    if (!data || data.length === 0) break;
    allEthscriptions = allEthscriptions.concat(data);
    if (data.length < chunkSize) break;
    start += chunkSize;
  }

  const transferred = allEthscriptions.filter(e =>
    e.creator.toLowerCase() !== e.owner.toLowerCase()
  );

  console.log(`Total ethscriptions: ${allEthscriptions.length}`);
  console.log(`Transferred (creator !== owner): ${transferred.length}`);

  if (transferred.length > 0) {
    console.log('\nSample transferred ethscriptions:');
    transferred.slice(0, 5).forEach(e => {
      console.log(`  ${e.hashId}`);
      console.log(`    creator: ${e.creator}`);
      console.log(`    owner: ${e.owner}`);
    });
  }
}

checkAllEventTypes();
