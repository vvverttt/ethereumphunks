const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkEventTypes() {
  console.log('📊 Checking event types in database...\n');

  // Get all distinct event types
  const { data: allEvents, error } = await supabase
    .from('events')
    .select('type')
    .limit(10000);

  if (error) {
    console.error('❌ Error fetching events:', error);
    return;
  }

  // Count by type
  const typeCounts = {};
  allEvents.forEach(event => {
    typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
  });

  console.log('Event type counts:');
  Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  console.log(`\nTotal events: ${allEvents.length}`);

  // Sample a few of each type
  console.log('\n📝 Sample events by type:\n');

  for (const type of Object.keys(typeCounts)) {
    const { data: samples } = await supabase
      .from('events')
      .select('*')
      .eq('type', type)
      .limit(2);

    if (samples && samples.length > 0) {
      console.log(`\n${type} event sample:`);
      console.log(JSON.stringify(samples[0], null, 2));
    }
  }

  // Check for ethscriptions that might have transfers
  console.log('\n\n📊 Checking ethscriptions table for owner changes...');

  const { data: ethscriptions } = await supabase
    .from('ethscriptions')
    .select('hashId, creator, owner')
    .limit(100);

  if (ethscriptions) {
    const transferred = ethscriptions.filter(e => e.creator !== e.owner);
    console.log(`\nEthscriptions with different creator/owner: ${transferred.length} out of ${ethscriptions.length} sampled`);

    if (transferred.length > 0) {
      console.log('\nSample transferred ethscription:');
      console.log(JSON.stringify(transferred[0], null, 2));
    }
  }

  // Check listings table
  console.log('\n\n📊 Checking listings table...');

  const { count: listingsCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true });

  console.log(`Total listings: ${listingsCount || 0}`);

  const { data: listings } = await supabase
    .from('listings')
    .select('*')
    .limit(3);

  if (listings && listings.length > 0) {
    console.log('\nSample listing:');
    console.log(JSON.stringify(listings[0], null, 2));
  }
}

checkEventTypes();
