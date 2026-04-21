import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Your Supabase credentials
const supabaseUrl = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const supabaseServiceKey = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function importCollection() {
  console.log('🚀 Starting import...');

  // Read JSON file
  const jsonPath = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\cryptophunks-v67.json';
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  console.log(`📦 Collection: ${data.name}`);
  console.log(`📊 Total Items: ${data.total_supply}`);

  // 1. Insert Collection
  console.log('\n1️⃣ Inserting collection...');
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .upsert({
      slug: data.slug,
      name: data.name,
      description: data.description || '',
      image: data.logo_image || null,
      singleName: 'QuantumPhunk',
      active: true,
      supply: data.total_supply,
      website: data.website_url,
      twitter: data.twitter_url,
      discord: data.discord_url,
      notifications: false,
      mintEnabled: false,
      hasBackgrounds: false,
      standalone: true,
      defaultBackground: data.background_color || null
    }, {
      onConflict: 'slug'
    });

  if (collectionError) {
    console.error('❌ Collection error:', collectionError);
    return;
  }
  console.log('✅ Collection inserted!');

  // 2. Insert Attributes FIRST (required by foreign key constraint)
  console.log('\n2️⃣ Inserting attributes...');
  const batchSize = 100;
  const items = data.collection_items;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const attributes = batch.map(item => {
      // Convert attributes array to object format
      const values = {};
      item.attributes.forEach(attr => {
        values[attr.trait_type] = attr.value;
      });

      return {
        sha: item.sha,
        tokenId: item.index,
        slug: data.slug,
        values: values
      };
    });

    const { error } = await supabase
      .from('attributes')
      .upsert(attributes, {
        onConflict: 'sha',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`❌ Error attributes batch ${i}-${i + batch.length}:`, error);
    } else {
      console.log(`✅ Attributes ${i + batch.length}/${items.length}`);
    }
  }

  // 3. Insert Ethscriptions (batch of 100)
  console.log('\n3️⃣ Inserting ethscriptions...');
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const ethscriptions = batch.map(item => ({
      hashId: item.id,
      sha: item.sha,
      tokenId: item.index,
      slug: data.slug,
      creator: null, // You can add creator address if you have it
      owner: null,   // Owner will be set when indexed from blockchain
      prevOwner: null,
      locked: false,
      createdAt: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('ethscriptions')
      .upsert(ethscriptions, {
        onConflict: 'hashId',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`❌ Error batch ${i}-${i + batch.length}:`, error);
    } else {
      console.log(`✅ Inserted ${i + batch.length}/${items.length}`);
    }
  }

  console.log('\n🎉 Import complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   Collection: ${data.name}`);
  console.log(`   Slug: ${data.slug}`);
  console.log(`   Items: ${data.total_supply}`);
  console.log(`\n🌐 View in Supabase: ${supabaseUrl}/project/hzpwkpjxhtpcygrwtwku/editor`);
}

importCollection().catch(console.error);
