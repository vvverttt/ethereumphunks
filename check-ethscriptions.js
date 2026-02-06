const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkEthscriptions() {
  console.log('📊 Checking ethscriptions table...\n');

  // Count total ethscriptions
  const { count, error: countError } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error counting ethscriptions:', countError);
    return;
  }

  console.log(`Total ethscriptions: ${count}`);

  // Get sample to see structure
  const { data, error } = await supabase
    .from('ethscriptions')
    .select('*')
    .limit(3);

  if (error) {
    console.error('❌ Error fetching sample ethscription:', error);
  } else if (data && data.length > 0) {
    console.log('\n📝 Sample ethscription:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\n📋 Available columns:');
    console.log(Object.keys(data[0]).join(', '));

    // Check if there's a txHash or similar field
    if (data[0].txHash || data[0].transactionHash || data[0].hash) {
      console.log('\n✅ Transaction hash fields found!');
    }
  }

  // Check listings table
  console.log('\n📊 Checking listings table...');
  const { count: listingsCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true });

  console.log(`Total listings: ${listingsCount}`);

  // Get sample listing
  const { data: listingData } = await supabase
    .from('listings')
    .select('*')
    .limit(1);

  if (listingData && listingData.length > 0) {
    console.log('\n📝 Sample listing columns:');
    console.log(Object.keys(listingData[0]).join(', '));
  }
}

checkEthscriptions();
