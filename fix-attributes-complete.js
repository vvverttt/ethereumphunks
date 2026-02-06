import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function fixAttributes() {
  console.log('🔧 Fixing attributes with array format for multiple values...\n');

  // Step 1: Clear existing data
  console.log('🗑️  Clearing existing cryptophunksv67 data...');
  const { error: deleteError } = await supabase
    .from('attributes_new')
    .delete()
    .eq('slug', 'cryptophunksv67');

  if (deleteError) {
    console.log('❌ Error clearing data:', deleteError.message);
    return;
  }
  console.log('✅ Cleared\n');

  // Step 2: Load JSON
  const jsonData = JSON.parse(
    fs.readFileSync('C:\\Users\\alber\\OneDrive\\Desktop\\market\\cryptophunks-v67.json', 'utf-8')
  );

  console.log(`📊 Loaded ${jsonData.collection_items.length} items from JSON\n`);

  let inserted = 0;
  let errors = 0;

  // Step 3: Insert with array format for multiple values
  for (let i = 0; i < jsonData.collection_items.length; i += 100) {
    const batch = jsonData.collection_items.slice(i, i + 100);

    const rows = batch.map(item => {
      // Convert attributes array to values object
      // If multiple values for same key, create array
      const values = {};

      for (const attr of item.attributes || []) {
        const key = attr.trait_type;
        const value = attr.value;

        if (values[key]) {
          // Already exists, convert to array or append
          if (Array.isArray(values[key])) {
            values[key].push(value);
          } else {
            values[key] = [values[key], value];
          }
        } else {
          values[key] = value;
        }
      }

      return {
        slug: 'cryptophunksv67',
        tokenId: item.index,
        sha: item.sha,
        values: values
      };
    });

    const { error } = await supabase
      .from('attributes_new')
      .insert(rows);

    if (error) {
      console.log(`❌ Batch ${Math.floor(i / 100) + 1}: ${error.message}`);
      errors++;
    } else {
      inserted += rows.length;
      if (inserted % 500 === 0 || inserted === jsonData.collection_items.length) {
        console.log(`✅ Progress: ${inserted}/${jsonData.collection_items.length}`);
      }
    }
  }

  console.log(`\n✨ Restore Complete!`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Errors: ${errors}`);

  // Step 4: Verify "One of One" count
  console.log(`\n🔍 Verifying "One of One" count...`);

  const { data: allData } = await supabase
    .from('attributes_new')
    .select('sha, values')
    .eq('slug', 'cryptophunksv67');

  let oneOfOneCount = 0;
  for (const item of allData) {
    const special = item.values?.Special;

    // Check if Special contains "One of One" (string or array)
    if (special === 'One of One') {
      oneOfOneCount++;
    } else if (Array.isArray(special) && special.includes('One of One')) {
      oneOfOneCount++;
    }
  }

  console.log(`   "One of One" count: ${oneOfOneCount} (should be 719)`);

  if (oneOfOneCount === 719) {
    console.log(`   ✅ Perfect match!\n`);
  } else {
    console.log(`   ⚠️  Count mismatch!\n`);
  }

  // Show sample with multiple Special values
  const sampleMultiple = allData.find(item => Array.isArray(item.values?.Special));
  if (sampleMultiple) {
    console.log('📝 Sample item with multiple Special values:');
    console.log(`   sha: ${sampleMultiple.sha.substring(0, 20)}...`);
    console.log(`   Special: ${JSON.stringify(sampleMultiple.values.Special)}`);
  }
}

fixAttributes().catch(console.error);
