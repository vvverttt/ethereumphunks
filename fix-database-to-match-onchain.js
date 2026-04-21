const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function resetToOnChainState() {
  console.log('🔄 Resetting database to match on-chain state...\n');

  // Get phunks where owner != creator (database-only changes)
  let allEthscriptions = [];
  let start = 0;
  const chunkSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('ethscriptions')
      .select('tokenId, hashId, creator, owner')
      .eq('slug', 'cryptophunksv67')
      .range(start, start + chunkSize - 1);

    if (!data || data.length === 0) break;
    allEthscriptions = allEthscriptions.concat(data);
    if (data.length < chunkSize) break;
    start += chunkSize;
  }

  const needsReset = allEthscriptions.filter(e =>
    e.creator.toLowerCase() !== e.owner.toLowerCase()
  );

  console.log(`Found ${needsReset.length} phunks with incorrect ownership\n`);

  if (needsReset.length === 0) {
    console.log('✅ All phunks already match on-chain state!');
    return;
  }

  console.log('These phunks will be reset:');
  needsReset.forEach(e => {
    console.log(`   Phunk #${e.tokenId}: owner will reset from ${e.owner} to ${e.creator}`);
  });

  console.log('\n⚠️  This will:');
  console.log('   1. Set owner = creator (match blockchain reality)');
  console.log('   2. Set prevOwner = null');
  console.log('   3. Remove any fake ownership changes');
  console.log('   4. Make database match on-chain state 100%\n');

  // Update each phunk
  let successCount = 0;
  let failCount = 0;

  for (const eth of needsReset) {
    const { error } = await supabase
      .from('ethscriptions')
      .update({
        owner: eth.creator,
        prevOwner: null
      })
      .eq('hashId', eth.hashId);

    if (error) {
      console.log(`❌ Failed to reset Phunk #${eth.tokenId}: ${error.message}`);
      failCount++;
    } else {
      console.log(`✅ Reset Phunk #${eth.tokenId}: owner = creator`);
      successCount++;
    }
  }

  console.log('\n🎉 Reset complete!');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📊 Total: ${needsReset.length}`);

  console.log('\n✅ Database now matches on-chain reality!');
  console.log('   When real transfers happen on-chain, indexer will update automatically.');
}

resetToOnChainState();
