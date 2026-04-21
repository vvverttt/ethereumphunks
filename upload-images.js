import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const supabaseServiceKey = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const imagesDir = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\images_24x24';
const bucketName = 'mint-images';

async function uploadImages() {
  console.log('🚀 Starting image upload to Supabase Storage...\n');

  // 1. Check if bucket exists, if not create it
  console.log('1️⃣ Checking storage bucket...');
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('❌ Error listing buckets:', listError.message);
    return;
  }

  const bucketExists = buckets.some(b => b.name === bucketName);

  if (!bucketExists) {
    console.log(`   Creating bucket "${bucketName}"...`);
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
    });

    if (createError) {
      console.error('❌ Error creating bucket:', createError.message);
      return;
    }
    console.log(`   ✅ Created bucket "${bucketName}"`);
  } else {
    console.log(`   ✅ Bucket "${bucketName}" already exists`);
  }

  // 2. Read all image files
  console.log('\n2️⃣ Reading images from directory...');
  const files = fs.readdirSync(imagesDir);
  const imageFiles = files.filter(f =>
    f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.gif') || f.endsWith('.svg')
  );

  console.log(`   Found ${imageFiles.length} images\n`);

  // 3. Upload images
  console.log('3️⃣ Uploading images...');
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of imageFiles) {
    const filePath = path.join(imagesDir, file);
    const fileBuffer = fs.readFileSync(filePath);

    // Determine content type
    const ext = path.extname(file).toLowerCase();
    const contentType = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    }[ext] || 'application/octet-stream';

    // Upload to Supabase Storage
    // Path format: cryptophunksv67/1.png (or whatever naming convention you use)
    const storagePath = `cryptophunksv67/${file}`;

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      if (error.message.includes('already exists')) {
        skipped++;
        if (skipped <= 5) {
          console.log(`   ⏭️  Skipped ${file} (already exists)`);
        }
      } else {
        errors++;
        console.error(`   ❌ Error uploading ${file}:`, error.message);
      }
    } else {
      uploaded++;
      if (uploaded % 100 === 0 || uploaded <= 10) {
        console.log(`   ✅ Uploaded ${uploaded}/${imageFiles.length} images...`);
      }
    }
  }

  console.log('\n✨ Upload complete!');
  console.log('\n📊 Summary:');
  console.log(`   - Total images: ${imageFiles.length}`);
  console.log(`   - Uploaded: ${uploaded}`);
  console.log(`   - Skipped: ${skipped}`);
  console.log(`   - Errors: ${errors}`);

  console.log('\n🌐 Images URL:');
  console.log(`   ${supabaseUrl}/storage/v1/object/public/${bucketName}/cryptophunksv67/`);
}

uploadImages().catch(console.error);
