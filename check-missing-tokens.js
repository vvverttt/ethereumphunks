import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function checkMissingTokens() {
  console.log('🔍 Checking for missing tokens...\n');

  // Load JSON
  const jsonData = JSON.parse(
    fs.readFileSync('C:\\Users\\alber\\OneDrive\\Desktop\\market\\cryptophunks-v67.json', 'utf-8')
  );

  const jsonTokenIds = new Set(jsonData.collection_items.map(i => i.index));
  console.log(`📊 JSON has ${jsonTokenIds.size} unique token IDs`);
  console.log(`   Range: ${Math.min(...jsonTokenIds)} to ${Math.max(...jsonTokenIds)}\n`);

  // Get all database tokens
  const { data: dbData, count } = await supabase
    .from('attributes_new')
    .select('tokenId', { count: 'exact' })
    .eq('slug', 'cryptophunksv67');

  console.log(`📊 Database has ${count} total rows`);

  const dbTokenIds = new Set(dbData.map(i => i.tokenId));
  console.log(`   Unique token IDs: ${dbTokenIds.size}\n`);

  // Find duplicates in database
  const tokenCounts = {};
  for (const item of dbData) {
    tokenCounts[item.tokenId] = (tokenCounts[item.tokenId] || 0) + 1;
  }

  const duplicates = Object.entries(tokenCounts).filter(([id, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log(`⚠️  ${duplicates.length} token IDs appear multiple times in database!`);
    console.log(`   First 5 duplicates:`);
    for (let i = 0; i < Math.min(5, duplicates.length); i++) {
      const [id, count] = duplicates[i];
      console.log(`      Token #${id}: ${count} times`);
    }
    console.log('');
  }

  // Find missing tokens
  const missingInDb = [...jsonTokenIds].filter(id => !dbTokenIds.has(id));
  if (missingInDb.length > 0) {
    console.log(`⚠️  ${missingInDb.length} tokens in JSON but NOT in database!`);
    console.log(`   First 10: ${missingInDb.slice(0, 10).join(', ')}\n`);

    // Check if missing tokens have duplicate SHAs
    const missingShas = jsonData.collection_items
      .filter(i => missingInDb.includes(i.index))
      .map(i => i.sha);

    console.log(`   Checking if SHAs are duplicated...`);
    const shaCheck = await supabase
      .from('attributes_new')
      .select('sha, tokenId')
      .eq('slug', 'cryptophunksv67')
      .in('sha', missingShas.slice(0, 10));

    if (shaCheck.data.length > 0) {
      console.log(`   ⚠️  Found ${shaCheck.data.length} rows with same SHAs!`);
      for (const row of shaCheck.data.slice(0, 5)) {
        const jsonItem = jsonData.collection_items.find(i => i.sha === row.sha);
        console.log(`      SHA ${row.sha.substring(0, 12)}... → Token #${row.tokenId} (should be #${jsonItem.index})`);
      }
    }
  }

  // Check for UNIQUE constraint
  console.log('\n🔍 Checking UNIQUE constraint on (slug, sha)...');
  const jsonShas = new Set(jsonData.collection_items.map(i => i.sha));
  if (jsonShas.size < jsonData.collection_items.length) {
    console.log(`   ⚠️  JSON has ${jsonData.collection_items.length - jsonShas.size} duplicate SHAs!`);
    console.log(`   This would cause INSERT failures due to UNIQUE(slug, sha) constraint!`);
  } else {
    console.log(`   ✅ All SHAs in JSON are unique`);
  }
}

checkMissingTokens().catch(console.error);
