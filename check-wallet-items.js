import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function checkWalletItems() {
  const walletAddress = '0xea04f65f9dc5917302532859d80fcf36a15de266';
  const marketAddress = '0xd3418772623be1a3cc6b6d45cb46420cedd9154a';

  console.log(`🔍 Checking items for wallet: ${walletAddress}\n`);

  // Count cryptophunksv67 items owned directly
  const { count: ownedCount } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('slug', 'cryptophunksv67')
    .eq('owner', walletAddress);

  console.log(`📊 Owned directly (cryptophunksv67): ${ownedCount}`);

  // Count items in escrow (prevOwner)
  const { count: escrowCount } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('slug', 'cryptophunksv67')
    .eq('owner', marketAddress)
    .eq('prevOwner', walletAddress);

  console.log(`📊 In escrow (prevOwner = wallet): ${escrowCount}`);
  console.log(`📊 Total cryptophunksv67: ${ownedCount + escrowCount}\n`);

  // Count ALL ethscriptions (all collections)
  const { count: totalOwned } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('owner', walletAddress);

  const { count: totalEscrowed } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('owner', marketAddress)
    .eq('prevOwner', walletAddress);

  console.log(`📊 All collections owned directly: ${totalOwned}`);
  console.log(`📊 All collections in escrow: ${totalEscrowed}`);
  console.log(`📊 Total ALL ethscriptions: ${totalOwned + totalEscrowed}\n`);

  // Test RPC
  console.log('🧪 Testing RPC with max_results=10000...');
  const { data: rpcData, error } = await supabase.rpc(
    'fetch_ethscriptions_owned_with_listings_and_bids',
    {
      address: walletAddress,
      collection_slug: 'cryptophunksv67',
      max_results: 10000
    }
  );

  if (error) {
    console.log(`❌ RPC Error: ${error.message}`);
  } else {
    console.log(`✅ RPC returned: ${rpcData?.length || 0} items`);

    if (rpcData.length < (ownedCount + escrowCount)) {
      console.log(`⚠️  RPC is missing ${(ownedCount + escrowCount) - rpcData.length} items!`);
    } else {
      console.log(`✅ RPC is returning all cryptophunksv67 items correctly!`);
    }
  }

  // Check what collections this wallet owns
  console.log('\n📋 Collections owned by this wallet:');
  const { data: collections } = await supabase
    .from('ethscriptions')
    .select('slug')
    .eq('owner', walletAddress);

  const slugCounts = {};
  for (const item of collections) {
    slugCounts[item.slug] = (slugCounts[item.slug] || 0) + 1;
  }

  const sorted = Object.entries(slugCounts).sort((a, b) => b[1] - a[1]);
  for (const [slug, count] of sorted) {
    console.log(`   ${slug}: ${count} items`);
  }
}

checkWalletItems().catch(console.error);
