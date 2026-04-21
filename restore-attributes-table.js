import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function restoreAttributes() {
  console.log('🔧 Restoring attributes_new table...\n');

  // Load the original JSON
  const jsonData = JSON.parse(
    fs.readFileSync('C:\\Users\\alber\\OneDrive\\Desktop\\market\\cryptophunks-v67.json', 'utf-8')
  );

  console.log(`📊 Loaded ${jsonData.collection_items.length} items from JSON\n`);

  let inserted = 0;
  let errors = 0;

  // Insert in batches of 100
  for (let i = 0; i < jsonData.collection_items.length; i += 100) {
    const batch = jsonData.collection_items.slice(i, i + 100);

    const rows = batch.map(item => {
      // Convert attributes array to values object with arrays for multiple values
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
      if (inserted % 500 === 0) {
        console.log(`✅ Progress: ${inserted}/${jsonData.collection_items.length}`);
      }
    }
  }

  console.log(`\n✨ Restore Complete!`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Errors: ${errors}`);

  // Verify
  const { count } = await supabase
    .from('attributes_new')
    .select('*', { count: 'exact', head: true })
    .eq('slug', 'cryptophunksv67');

  console.log(`\n📊 Verification:`);
  console.log(`   Total rows in attributes_new: ${count}`);
}

restoreAttributes().catch(console.error);
