const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkAllEvents() {
  console.log('🔍 Checking all events in database...\n');

  // Count all event types
  const { data: allEvents } = await supabase
    .from('events')
    .select('type, hashId, from, to, blockTimestamp')
    .order('blockTimestamp', { ascending: true })
    .limit(10000);

  if (!allEvents) {
    console.log('❌ No events found');
    return;
  }

  // Count by type
  const typeCounts = {};
  allEvents.forEach(event => {
    typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
  });

  console.log('📊 Event counts:');
  Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

  // Get all ethscriptions for cryptophunksv67
  console.log('\n\n🔍 Checking ethscriptions ownership...\n');

  let allEthscriptions = [];
  let start = 0;
  const chunkSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('ethscriptions')
      .select('tokenId, hashId, creator, owner, prevOwner')
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
    console.log('\n📋 Transferred phunks details:\n');

    for (const eth of transferred) {
      console.log(`Phunk #${eth.tokenId}:`);
      console.log(`  creator: ${eth.creator}`);
      console.log(`  prevOwner: ${eth.prevOwner || 'null'}`);
      console.log(`  owner: ${eth.owner}`);

      // Check if there are ANY events for this hashId
      const { data: events } = await supabase
        .from('events')
        .select('type, from, to, blockTimestamp')
        .eq('hashId', eth.hashId)
        .order('blockTimestamp', { ascending: true });

      if (events && events.length > 0) {
        console.log(`  Events: ${events.length}`);
        events.forEach(e => {
          console.log(`    - ${e.type}: ${e.from.substring(0, 10)}... → ${e.to.substring(0, 10)}... (${new Date(e.blockTimestamp).toISOString().substring(0, 10)})`);
        });
      } else {
        console.log(`  Events: 0`);
      }
      console.log();
    }
  }

  // Check for any transfer events at all
  console.log('\n\n🔍 Checking for ANY transfer events...\n');

  const { data: transferEvents } = await supabase
    .from('events')
    .select('*')
    .eq('type', 'transfer')
    .limit(10);

  console.log(`Found ${transferEvents?.length || 0} transfer events in entire database`);

  if (transferEvents && transferEvents.length > 0) {
    console.log('\nSample transfer events:');
    transferEvents.forEach((e, idx) => {
      console.log(`  ${idx + 1}. ${e.hashId.substring(0, 10)}... : ${e.from.substring(0, 10)}... → ${e.to.substring(0, 10)}...`);
    });
  }
}

checkAllEvents();
