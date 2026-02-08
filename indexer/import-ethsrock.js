const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const JSON_FILE = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\EthsRock-with-sha.json';
const IMAGES_DIR = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\ether_rocks_original';
const SLUG = 'ethsrock';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function main() {
  console.log('🚀 Starting EthsRock import...\n');
  const startTime = Date.now();

  // Read JSON file
  console.log('📖 Reading JSON file...');
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  const items = jsonData.collection_items;
  console.log(`✅ Loaded ${items.length} items\n`);

  // Step 1: Insert into collections table
  console.log('📦 Step 1: Inserting collection row...');
  const { error: colError } = await supabase
    .from('collections')
    .upsert([{
      slug: SLUG,
      name: 'EthsRock',
      singleName: 'EthsRock',
      description: jsonData.description || 'Ethscription-crafted digital artifacts',
      supply: items.length,
      active: true,
      isMinting: false,
      mintEnabled: false,
      hasBackgrounds: false,
      notifications: false,
      website: jsonData.website_url || null,
      twitter: jsonData.twitter_url || null,
      discord: jsonData.discord_url || null,
    }], { onConflict: 'slug' });

  if (colError) {
    console.error('❌ Error inserting collection:', colError);
    return;
  }
  console.log('✅ Collection row inserted\n');

  // Step 2: Insert into attributes_new table
  console.log('📦 Step 2: Inserting attributes_new rows...');
  const attrRows = items.map(item => {
    // Transform [{trait_type, value}] → {"Key": "Value"}
    const values = {};
    item.attributes.forEach(attr => {
      values[attr.trait_type] = attr.value;
    });
    return {
      sha: item.sha,
      values,
      slug: SLUG,
      tokenId: item.index,
    };
  });

  // Batch insert in chunks of 50
  let attrInserted = 0;
  for (let i = 0; i < attrRows.length; i += 50) {
    const batch = attrRows.slice(i, i + 50);
    const { error: attrError } = await supabase
      .from('attributes_new')
      .insert(batch);

    if (attrError) {
      console.error(`❌ Error inserting attributes batch ${i}:`, attrError);
    } else {
      attrInserted += batch.length;
      console.log(`   Inserted ${attrInserted}/${attrRows.length} attributes`);
    }
  }
  console.log(`✅ ${attrInserted} attributes inserted\n`);

  // Step 3: Upload images to Supabase storage
  console.log('🖼️  Step 3: Uploading images to storage...');
  let imgUploaded = 0;
  let imgSkipped = 0;
  let imgErrors = 0;

  for (const item of items) {
    // Try .png first, then .webp
    let imgPath = path.join(IMAGES_DIR, `${item.index}.png`);
    let contentType = 'image/png';
    if (!fs.existsSync(imgPath)) {
      imgPath = path.join(IMAGES_DIR, `${item.index}.webp`);
      contentType = 'image/webp';
    }
    if (!fs.existsSync(imgPath)) {
      console.error(`   ❌ Image not found: ${item.index}.png or .webp`);
      imgErrors++;
      continue;
    }

    const imgBuffer = fs.readFileSync(imgPath);
    const storagePath = `images/${item.sha}`;

    const { error: uploadError } = await supabase.storage
      .from('static')
      .upload(storagePath, imgBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      if (uploadError.message?.includes('already exists')) {
        imgSkipped++;
      } else {
        console.error(`   ❌ Upload error for ${item.index}.png:`, uploadError.message);
        imgErrors++;
      }
    } else {
      imgUploaded++;
    }

    // Progress every 10 items
    if ((item.index + 1) % 10 === 0) {
      console.log(`   Progress: ${item.index + 1}/${items.length} (uploaded: ${imgUploaded}, skipped: ${imgSkipped})`);
    }
  }
  console.log(`✅ Images: ${imgUploaded} uploaded, ${imgSkipped} skipped, ${imgErrors} errors\n`);

  // Step 4: Generate and upload attributes JSON for frontend
  console.log('📄 Step 4: Generating and uploading ethsrock_attributes.json...');
  const attributesJson = {};
  items.forEach(item => {
    attributesJson[item.sha] = item.attributes.map(attr => ({
      k: attr.trait_type,
      v: attr.value,
    }));
  });

  const jsonBuffer = Buffer.from(JSON.stringify(attributesJson), 'utf8');
  const { error: jsonError } = await supabase.storage
    .from('data')
    .upload(`${SLUG}_attributes.json`, jsonBuffer, {
      contentType: 'application/json',
      upsert: true,
    });

  if (jsonError) {
    console.error('❌ Error uploading attributes JSON:', jsonError);
  } else {
    console.log('✅ ethsrock_attributes.json uploaded to data bucket\n');
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log('🎉 Import complete!');
  console.log(`   Duration: ${duration}s`);
  console.log(`   Collection: ${SLUG}`);
  console.log(`   Attributes: ${attrInserted}`);
  console.log(`   Images: ${imgUploaded} uploaded, ${imgSkipped} skipped`);
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
