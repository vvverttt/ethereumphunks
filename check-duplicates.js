import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function checkDuplicates() {
  console.log('🔍 Checking for duplicates and unnecessary data...\n');

  // Check attributes_new table
  const { data: attrsNew } = await supabase
    .from('attributes_new')
    .select('sha, tokenId, slug')
    .eq('slug', 'cryptophunksv67');

  console.log('📊 attributes_new table:');
  console.log(`   Total rows: ${attrsNew.length}`);

  // Check for duplicate SHAs
  const shaCount = {};
  attrsNew.forEach(item => {
    shaCount[item.sha] = (shaCount[item.sha] || 0) + 1;
  });

  const duplicateShas = Object.entries(shaCount).filter(([sha, count]) => count > 1);
  console.log(`   Duplicate SHAs: ${duplicateShas.length}`);

  if (duplicateShas.length > 0) {
    console.log('\n   First 5 duplicate SHAs:');
    for (let i = 0; i < Math.min(5, duplicateShas.length); i++) {
      const [sha, count] = duplicateShas[i];
      console.log(`      ${sha.substring(0, 16)}... appears ${count} times`);
    }
  }

  // Check for duplicate tokenIds
  const tokenCount = {};
  attrsNew.forEach(item => {
    if (item.tokenId) {
      tokenCount[item.tokenId] = (tokenCount[item.tokenId] || 0) + 1;
    }
  });

  const duplicateTokens = Object.entries(tokenCount).filter(([id, count]) => count > 1);
  console.log(`\n   Duplicate tokenIds: ${duplicateTokens.length}`);

  if (duplicateTokens.length > 0) {
    console.log('   First 5 token duplicates:');
    for (let i = 0; i < Math.min(5, duplicateTokens.length); i++) {
      const [id, count] = duplicateTokens[i];
      console.log(`      Token #${id} appears ${count} times`);

      // Show which rows
      const rows = attrsNew.filter(a => a.tokenId == id);
      console.log(`         SHAs: ${rows.map(r => r.sha.substring(0, 12)).join(', ')}`);
    }
  }

  // Check if old attributes table exists
  try {
    const { data: oldAttrs, error } = await supabase
      .from('attributes')
      .select('*', { count: 'exact', head: true })
      .eq('slug', 'cryptophunksv67');

    if (!error) {
      console.log(`\n📊 OLD attributes table found:`);
      console.log(`   Total rows: ${oldAttrs || 'unknown'}`);
      console.log(`   ⚠️  This table may be obsolete!`);
    }
  } catch (e) {
    console.log('\n✅ No old "attributes" table found');
  }

  // Check ethscriptions table for duplicates
  const { data: ethscriptions } = await supabase
    .from('ethscriptions')
    .select('tokenId, hashId, sha')
    .eq('slug', 'cryptophunksv67');

  console.log(`\n📊 ethscriptions table:`);
  console.log(`   Total rows: ${ethscriptions.length}`);

  const ethsTokenCount = {};
  ethscriptions.forEach(item => {
    ethsTokenCount[item.tokenId] = (ethsTokenCount[item.tokenId] || 0) + 1;
  });

  const ethsDups = Object.entries(ethsTokenCount).filter(([id, count]) => count > 1);
  console.log(`   Duplicate tokenIds: ${ethsDups.length}`);

  if (ethsDups.length > 0) {
    console.log('\n   ⚠️  DUPLICATES FOUND IN ETHSCRIPTIONS:');
    for (let i = 0; i < Math.min(5, ethsDups.length); i++) {
      const [id, count] = ethsDups[i];
      console.log(`      Token #${id} appears ${count} times`);
    }
  }
}

checkDuplicates().catch(console.error);
