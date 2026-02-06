import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

async function updateDatabaseAttributes() {
  console.log('🔧 Updating database attributes_new table to Title Case...\n');

  // 1. Fetch all attributes
  let allAttributes = [];
  let page = 0;

  while (true) {
    const { data } = await supabase
      .from('attributes_new')
      .select('sha, values')
      .eq('slug', 'cryptophunksv67')
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (!data || data.length === 0) break;
    allAttributes = allAttributes.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  console.log(`✅ Fetched ${allAttributes.length} attribute records\n`);

  // 2. Update each record with Title Case keys
  let updated = 0;
  let errors = 0;

  for (const item of allAttributes) {
    const newValues = {};

    // Convert keys to Title Case
    for (const [key, value] of Object.entries(item.values)) {
      newValues[toTitleCase(key)] = value;
    }

    // Update the record
    const { error } = await supabase
      .from('attributes_new')
      .update({ values: newValues })
      .eq('sha', item.sha);

    if (error) {
      console.log(`❌ Error updating ${item.sha}: ${error.message}`);
      errors++;
    } else {
      updated++;
      if (updated % 100 === 0) {
        console.log(`   Progress: ${updated}/${allAttributes.length}`);
      }
    }
  }

  console.log(`\n✅ Update complete!`);
  console.log(`📊 Updated: ${updated}/${allAttributes.length}, Errors: ${errors}`);
}

updateDatabaseAttributes().catch(console.error);
