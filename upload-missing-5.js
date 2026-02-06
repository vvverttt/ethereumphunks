import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

const imagesDir = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\images_24x24';

// These are the SHAs we need
const missingShas = {
  5865: '6af4a178d1be472056ce36a61a43386cafc2e39c7dc59aef2b395ddaee34fc34',
  6850: '8129630f78225657b635d5e368d2b809f70af663bc689fde48bc4a98f5113e1a',
  6922: '3b2b3f97d83fa6ed6222deb397f42f23ca4ac38874648138407a6d607ee265e3',
  6996: 'bea1059e4469246e5a0491432593b8d2f1f0e336431e02777a9a5e7e0fbeedb5',
  8913: 'dfa337b1f3f585a5989971a47e6763a0537d48760328dc8df60f894c797fec08'
};

async function uploadMissing5() {
  console.log('🔍 Finding and uploading 5 missing images...\n');

  // Read all image files
  const files = fs.readdirSync(imagesDir).filter(f => f.endsWith('.png'));
  console.log(`📂 Found ${files.length} images in folder\n`);

  // Calculate SHA256 of each image to find matches
  console.log('🔎 Searching for matching images...\n');

  let found = 0;
  let uploaded = 0;

  for (const file of files) {
    const filePath = path.join(imagesDir, file);
    const fileBuffer = fs.readFileSync(filePath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Check if this SHA matches any of our missing ones
    for (const [tokenId, targetSha] of Object.entries(missingShas)) {
      if (sha256 === targetSha) {
        found++;
        console.log(`✅ Found Token #${tokenId}: ${file}`);
        console.log(`   SHA: ${sha256}`);

        // Upload to static/images/{sha}
        const { error } = await supabase.storage
          .from('static')
          .upload(`images/${sha256}`, fileBuffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (error) {
          console.log(`   ❌ Upload failed: ${error.message}`);
        } else {
          uploaded++;
          console.log(`   ✅ Uploaded successfully!\n`);
        }
      }
    }

    // Early exit if we found all 5
    if (found === 5) break;
  }

  console.log('\n✨ Complete!');
  console.log(`📊 Found: ${found}/5, Uploaded: ${uploaded}/5`);
}

uploadMissing5().catch(console.error);
