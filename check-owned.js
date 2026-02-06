import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function checkOwned() {
  const address = '0xea04f65f9dc5917302532859d80fcf36a15de266';

  console.log(`🔍 Checking ownership for: ${address}\n`);

  // Check how many have owner data
  const { data: all, count: totalCount } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact' })
    .eq('slug', 'cryptophunksv67');

  console.log(`📊 Total items in collection: ${totalCount}\n`);

  // Check how many have owner field populated
  const { data: withOwner, count: withOwnerCount } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact' })
    .eq('slug', 'cryptophunksv67')
    .not('owner', 'is', null);

  console.log(`✅ Items with owner data: ${withOwnerCount}/${totalCount}\n`);

  // Check items owned by this address
  const { data: owned, count: ownedCount } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact' })
    .eq('slug', 'cryptophunksv67')
    .eq('owner', address.toLowerCase());

  console.log(`👤 Items owned by ${address}: ${ownedCount}\n`);

  if (ownedCount > 0) {
    console.log('Sample owned items:');
    owned.slice(0, 5).forEach(item => {
      console.log(`  - Token #${item.tokenId}: ${item.hashId}`);
    });
  }

  // Check if owner field is empty/null for most items
  const { data: nullOwner, count: nullCount } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact' })
    .eq('slug', 'cryptophunksv67')
    .is('owner', null);

  console.log(`\n⚠️  Items with NULL owner: ${nullCount}/${totalCount}`);
  console.log(`\n📌 Summary:`);
  console.log(`   - ${withOwnerCount} items have owner data populated`);
  console.log(`   - ${nullCount} items still need owner data`);
  console.log(`   - You need to populate the remaining ${nullCount} items`);
}

checkOwned().catch(console.error);
