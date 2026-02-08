const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkSchema() {
  console.log('📊 Checking attributes_new table schema and data...\n');

  // Get a sample record to see the schema
  const { data, error, count } = await supabase
    .from('attributes_new')
    .select('*', { count: 'exact' })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`Total records in attributes_new: ${count}\n`);

  if (data && data.length > 0) {
    console.log('Sample record:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\nAvailable columns:');
    console.log(Object.keys(data[0]).join(', '));
  } else {
    console.log('❌ No data in attributes_new table');
  }
}

checkSchema().catch(console.error);
