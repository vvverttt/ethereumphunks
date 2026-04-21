import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

const imagesDir = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\images_24x24';

async function uploadBySha() {
  console.log('🚀 Uploading images by SHA hash...\n');

  // Get all ethscriptions ordered by tokenId
  console.log('1️⃣ Fetching ethscriptions...');
  let allItems = [];
  let page = 0;

  while (true) {
    const { data } = await supabase
      .from('ethscriptions')
      .select('tokenId, sha')
      .eq('slug', 'cryptophunksv67')
      .order('tokenId', { ascending: true })
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (!data || data.length === 0) break;
    allItems = allItems.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  console.log(`   ✅ ${allItems.length} items\n`);

  // Get list of image files
  const files = fs.readdirSync(imagesDir);
  const imageFiles = files.filter(f => f.endsWith('.png')).sort((a, b) => {
    return parseInt(a) - parseInt(b);
  });

  console.log(`2️⃣ Found ${imageFiles.length} image files\n`);
  console.log(`3️⃣ Uploading to static/images/ by SHA...\n`);

  let uploaded = 0;
  let errors = 0;

  for (let i = 0; i < Math.min(allItems.length, imageFiles.length); i++) {
    const item = allItems[i];
    const imageFile = imageFiles[i];
    const imagePath = path.join(imagesDir, imageFile);

    try {
      const imageBuffer = fs.readFileSync(imagePath);

      // Upload using SHA as filename (no extension)
      const { error } = await supabase.storage
        .from('static')
        .upload(`images/${item.sha}`, imageBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (error) {
        errors++;
        if (errors <= 10) {
          console.log(`   ❌ Token #${item.tokenId}: ${error.message}`);
        }
      } else {
        uploaded++;
      }

      if ((i + 1) % 100 === 0 || i === allItems.length - 1) {
        console.log(`   ⏳ ${i + 1}/${allItems.length} - Uploaded: ${uploaded}, Errors: ${errors}`);
      }

    } catch (err) {
      errors++;
      console.log(`   ❌ Token #${item.tokenId}: ${err.message}`);
    }
  }

  console.log('\n✨ Complete!');
  console.log(`📊 Uploaded: ${uploaded}, Errors: ${errors}`);
}

uploadBySha().catch(console.error);
