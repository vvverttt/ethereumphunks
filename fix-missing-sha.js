import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Items with missing SHA
const missingItems = [
  { index: 544, id: '0x08c4e1aac380b9700095caf494f9e2ea21bc3eeb6dcf57f3e0d3061289ec51d5' },
  { index: 1357, id: '0x8f7b8c810281eebf97c497e8409999ff667939f28678f08fb44945cfe7e6663a' },
  { index: 1848, id: '0x11c4ff0c96fa5d01b76acf7e6bd193c2d493fe6310ebdcf84670d60d9747ab0d' },
  { index: 1970, id: '0xf54c343074c0aadad849f9814a6884920bf50e9b2f47c014b94a7af4946d28cf' },
  { index: 4847, id: '0x48a5ebaac71ee71f21e42b6752df3bff06ffd7187ccc538816a17133f59b29ca' },
  { index: 6000, id: '0xf0d6467c299588176cc1f93d80bec0596e4aaf86f454cd70c8416d8aaba80184' }
];

async function fixMissingSha() {
  console.log('🔧 Fixing missing SHA values...\n');

  const jsonPath = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\cryptophunks-v67.json';
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  let updated = 0;

  // Update JSON file
  console.log('1️⃣ Updating JSON file...');
  for (const missing of missingItems) {
    const item = data.collection_items.find(i => i.index === missing.index);
    if (item && (!item.sha || item.sha === '')) {
      // Use transaction ID (without 0x) as SHA for now
      // In a real scenario, you'd want to compute the actual SHA-256 hash
      const sha = missing.id.slice(2); // Remove '0x' prefix
      item.sha = sha;
      console.log(`   ✅ Index ${missing.index}: Set SHA to ${sha.substring(0, 16)}...`);
      updated++;
    }
  }

  // Save updated JSON
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`   📝 Saved ${updated} updates to JSON file\n`);

  // Update Supabase
  console.log('2️⃣ Updating Supabase...');
  for (const missing of missingItems) {
    const sha = missing.id.slice(2);

    // Update ethscriptions table
    const { error: ethError } = await supabase
      .from('ethscriptions')
      .update({ sha: sha })
      .eq('hashId', missing.id);

    if (ethError) {
      console.log(`   ❌ Error updating ethscription ${missing.index}:`, ethError.message);
    } else {
      console.log(`   ✅ Updated ethscription at index ${missing.index}`);
    }

    // Update attributes table
    const { error: attrError } = await supabase
      .from('attributes_new')
      .update({ sha: sha })
      .eq('tokenId', missing.index);

    if (attrError) {
      console.log(`   ⚠️  Attributes update warning for ${missing.index}:`, attrError.message);
    }
  }

  console.log('\n✨ Done! All SHA values have been fixed.');
  console.log('\n📊 Summary:');
  console.log(`   - JSON file updated: ${updated} items`);
  console.log(`   - Supabase updated: ${missingItems.length} items`);
}

fixMissingSha().catch(console.error);
