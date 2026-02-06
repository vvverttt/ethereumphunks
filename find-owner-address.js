import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function findOwnerWithMostItems() {
  console.log('🔍 Finding owner with most items...\n');

  // Find top owners
  const { data, error } = await supabase
    .from('ethscriptions')
    .select('owner')
    .eq('slug', 'cryptophunksv67')
    .limit(5000);

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  // Count by owner
  const ownerCounts = {};
  for (const item of data) {
    ownerCounts[item.owner] = (ownerCounts[item.owner] || 0) + 1;
  }

  // Sort by count
  const sorted = Object.entries(ownerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('Top 10 owners:');
  for (const [owner, count] of sorted) {
    console.log(`   ${owner}: ${count} items`);
  }

  // Test RPC with top owner
  const topOwner = sorted[0][0];
  console.log(`\n🧪 Testing RPC with top owner: ${topOwner}\n`);

  const { data: owned, error: rpcError } = await supabase.rpc(
    'fetch_ethscriptions_owned_with_listings_and_bids',
    {
      address: topOwner,
      collection_slug: 'cryptophunksv67',
      max_results: 10000
    }
  );

  if (rpcError) {
    console.log('❌ RPC Error:', rpcError.message);
  } else {
    console.log(`✅ RPC returned ${owned?.length || 0} items`);
    console.log(`   Expected: ${sorted[0][1]} items`);

    if (owned.length < sorted[0][1]) {
      console.log(`\n⚠️  RPC is returning LESS than expected!`);
      console.log(`   Missing: ${sorted[0][1] - owned.length} items`);
    } else {
      console.log(`\n✅ RPC is working correctly!`);
    }
  }
}

findOwnerWithMostItems().catch(console.error);
