const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkEvents() {
  console.log('📊 Checking events table...\n');

  // Count total events
  const { count, error: countError } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error counting events:', countError);
  } else {
    console.log(`Total events: ${count}`);
  }

  // Get sample event to see structure
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error fetching sample event:', error);
  } else if (data && data.length > 0) {
    console.log('\n📝 Sample event structure:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\n📋 Available columns:');
    console.log(Object.keys(data[0]).join(', '));
  } else {
    console.log('⚠️  No events found in table');
  }
}

checkEvents();
