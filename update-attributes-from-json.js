import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function updateAttributes() {
  // Load JSON file
  const jsonData = JSON.parse(
    fs.readFileSync('C:\\Users\\alber\\OneDrive\\Desktop\\market\\cryptophunks-v67.json', 'utf-8')
  );

  console.log(`📊 Total items in JSON: ${jsonData.collection_items.length}\n`);

  let updated = 0;
  let errors = 0;
  let notFound = 0;

  for (const item of jsonData.collection_items) {
    try {
      // Convert attributes array to values object
      // For multiple values of same trait_type, join with comma or keep as array
      const values = {};

      for (const attr of item.attributes || []) {
        const traitType = attr.trait_type;
        const value = attr.value;

        // If trait already exists, convert to array or append
        if (values[traitType]) {
          if (Array.isArray(values[traitType])) {
            values[traitType].push(value);
          } else {
            values[traitType] = [values[traitType], value];
          }
        } else {
          values[traitType] = value;
        }
      }

      // Update by SHA (more reliable than hashId)
      const { data: existing, error: findError } = await supabase
        .from('attributes_new')
        .select('sha')
        .eq('sha', item.sha)
        .eq('slug', 'cryptophunksv67')
        .single();

      if (findError || !existing) {
        console.log(`⚠️  Token #${item.index}: Not found in database`);
        notFound++;
        continue;
      }

      // Update attributes
      const { error: updateError } = await supabase
        .from('attributes_new')
        .update({
          values: values,
          tokenId: item.index
        })
        .eq('sha', item.sha)
        .eq('slug', 'cryptophunksv67');

      if (updateError) {
        console.log(`❌ Token #${item.index}: ${updateError.message}`);
        errors++;
      } else {
        updated++;
        if (updated % 100 === 0) {
          console.log(`✅ Progress: ${updated}/${jsonData.collection_items.length}`);
        }
      }

      // Rate limiting
      if (updated % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } catch (err) {
      console.log(`❌ Token #${item.index}: ${err.message}`);
      errors++;
    }
  }

  console.log('\n✨ Update Complete!');
  console.log(`   Updated: ${updated}`);
  console.log(`   Not found: ${notFound}`);
  console.log(`   Errors: ${errors}`);

  // Verify One of One count
  const { data: oneOfOne } = await supabase
    .from('attributes_new')
    .select('values')
    .eq('slug', 'cryptophunksv67');

  const oneOfOneCount = oneOfOne.filter(attr => {
    const special = attr.values?.Special;
    if (Array.isArray(special)) {
      return special.includes('One of One');
    }
    return special === 'One of One';
  }).length;

  console.log(`\n📊 Verification:`);
  console.log(`   "One of One" count: ${oneOfOneCount} (should be 719)`);
}

updateAttributes().catch(console.error);
