const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkAttributes() {
  console.log('📊 Checking attributes_new table...\n');

  // Get all unique collection_name values with counts
  const { data, error } = await supabase
    .from('attributes_new')
    .select('collection_name');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  // Count occurrences of each collection
  const collectionCounts = {};
  data.forEach(item => {
    const collection = item.collection_name || 'null';
    collectionCounts[collection] = (collectionCounts[collection] || 0) + 1;
  });

  console.log('Collections in attributes_new table:');
  Object.entries(collectionCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([collection, count]) => {
      console.log(`   ${collection}: ${count} items`);
    });

  console.log(`\nTotal items in attributes_new: ${data.length}`);

  // Check if Ethereum Phunks exists
  const ethereumPhunksCount = collectionCounts['ethereum-phunks'] || collectionCounts['Ethereum Phunks'] || 0;
  if (ethereumPhunksCount > 0) {
    console.log(`\n✅ Ethereum Phunks found in attributes with ${ethereumPhunksCount} items`);
  } else {
    console.log('\n❌ Ethereum Phunks NOT found in attributes_new table');
    console.log('   This is why your collection is not being indexed!');
  }
}

checkAttributes().catch(console.error);
