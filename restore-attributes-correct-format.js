import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function restoreAttributes() {
  console.log('🔧 Restoring attributes_new table with correct format...\n');

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
      // Convert attributes array to flat JSON object (NOT nested arrays)
      // Format: {"Type": "Male", "Animal": "Turtle", "Special": "One of One"}
      const values = {};

      for (const attr of item.attributes || []) {
        const key = attr.trait_type;
        const value = attr.value;

        // Store each value directly - if there are multiples with same key,
        // the last one wins (this matches the mfpurrs format)
        values[key] = value;
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

  // Show sample row
  const { data: sample } = await supabase
    .from('attributes_new')
    .select('sha, values, slug, tokenId')
    .eq('slug', 'cryptophunksv67')
    .limit(1)
    .single();

  console.log('\nSample row:');
  console.log(`   sha: ${sample.sha}`);
  console.log(`   values: ${JSON.stringify(sample.values)}`);
  console.log(`   slug: ${sample.slug}`);
  console.log(`   tokenId: ${sample.tokenId}`);
}

restoreAttributes().catch(console.error);
