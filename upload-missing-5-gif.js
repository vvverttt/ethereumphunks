import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

const imagesDir = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\images_24x24';

const missingTokens = [5865, 6850, 6922, 6996, 8913];
const missingShas = {
  5865: '6af4a178d1be472056ce36a61a43386cafc2e39c7dc59aef2b395ddaee34fc34',
  6850: '8129630f78225657b635d5e368d2b809f70af663bc689fde48bc4a98f5113e1a',
  6922: '3b2b3f97d83fa6ed6222deb397f42f23ca4ac38874648138407a6d607ee265e3',
  6996: 'bea1059e4469246e5a0491432593b8d2f1f0e336431e02777a9a5e7e0fbeedb5',
  8913: 'dfa337b1f3f585a5989971a47e6763a0537d48760328dc8df60f894c797fec08'
};

async function uploadGifs() {
  console.log('🔍 Uploading 5 GIF images...\n');

  let uploaded = 0;
  let errors = 0;

  for (const tokenId of missingTokens) {
    const gifPath = path.join(imagesDir, `${tokenId}.gif`);
    const sha = missingShas[tokenId];

    if (!fs.existsSync(gifPath)) {
      console.log(`❌ Token #${tokenId}: ${tokenId}.gif not found`);
      errors++;
      continue;
    }

    try {
      const fileBuffer = fs.readFileSync(gifPath);
      console.log(`✅ Found Token #${tokenId}.gif`);

      // Upload to static/images/{sha}
      const { error } = await supabase.storage
        .from('static')
        .upload(`images/${sha}`, fileBuffer, {
          contentType: 'image/gif',
          upsert: true,
        });

      if (error) {
        console.log(`   ❌ Upload failed: ${error.message}\n`);
        errors++;
      } else {
        uploaded++;
        console.log(`   ✅ Uploaded as ${sha}\n`);
      }
    } catch (err) {
      console.log(`❌ Token #${tokenId}: ${err.message}\n`);
      errors++;
    }
  }

  console.log('✨ Complete!');
  console.log(`📊 Uploaded: ${uploaded}/5, Errors: ${errors}/5`);
}

uploadGifs().catch(console.error);
