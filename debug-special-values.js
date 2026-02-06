import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function debugSpecialValues() {
  console.log('🔍 Debugging Special attribute values...\n');

  // Load original JSON
  const jsonData = JSON.parse(
    fs.readFileSync('C:\\Users\\alber\\OneDrive\\Desktop\\market\\cryptophunks-v67.json', 'utf-8')
  );

  // Find all unique Special values in JSON
  const jsonSpecialValues = new Set();
  const jsonOneOfOneTokens = new Set();

  for (const item of jsonData.collection_items) {
    for (const attr of item.attributes || []) {
      if (attr.trait_type === 'Special') {
        jsonSpecialValues.add(attr.value);

        if (attr.value === 'One of One') {
          jsonOneOfOneTokens.add(item.index);
        }
      }
    }
  }

  console.log('📊 Original JSON Special values:');
  console.log([...jsonSpecialValues].sort().join(', '));
  console.log(`\nTokens with "One of One": ${jsonOneOfOneTokens.size}\n`);

  // Get database data
  const { data: dbData } = await supabase
    .from('attributes_new')
    .select('tokenId, sha, values')
    .eq('slug', 'cryptophunksv67');

  // Find all unique Special values in DB
  const dbSpecialValues = new Set();
  const dbOneOfOneTokens = new Set();
  const missingTokens = [];

  for (const item of dbData) {
    const special = item.values?.Special;

    if (special) {
      if (Array.isArray(special)) {
        special.forEach(v => dbSpecialValues.add(v));

        if (special.includes('One of One')) {
          dbOneOfOneTokens.add(item.tokenId);
        }
      } else {
        dbSpecialValues.add(special);

        if (special === 'One of One') {
          dbOneOfOneTokens.add(item.tokenId);
        }
      }
    }
  }

  console.log('📊 Database Special values:');
  console.log([...dbSpecialValues].sort().join(', '));
  console.log(`\nTokens with "One of One": ${dbOneOfOneTokens.size}\n`);

  // Find missing tokens
  for (const tokenId of jsonOneOfOneTokens) {
    if (!dbOneOfOneTokens.has(tokenId)) {
      missingTokens.push(tokenId);
    }
  }

  if (missingTokens.length > 0) {
    console.log(`⚠️  ${missingTokens.length} tokens missing "One of One" in database!`);
    console.log(`First 10 missing: ${missingTokens.slice(0, 10).join(', ')}\n`);

    // Check one missing token
    const missingToken = missingTokens[0];
    const jsonItem = jsonData.collection_items.find(i => i.index === missingToken);
    const dbItem = dbData.find(i => i.tokenId === missingToken);

    console.log(`\n🔍 Checking Token #${missingToken}:`);
    console.log('\nJSON attributes:');
    console.log(JSON.stringify(jsonItem.attributes, null, 2));
    console.log('\nDB values:');
    console.log(JSON.stringify(dbItem.values, null, 2));
  }
}

debugSpecialValues().catch(console.error);
