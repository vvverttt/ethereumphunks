import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function uploadFile() {
  const filePath = 'cryptophunksv67_attributes.json';
  const bucketPath = 'cryptophunksv67_attributes.json';  // Path within the bucket (no prefix)

  console.log('📤 Uploading file to Supabase Storage...\n');

  // Read the file
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = (fileBuffer.length / 1024 / 1024).toFixed(2);

  console.log(`   File: ${filePath}`);
  console.log(`   Size: ${fileSize} MB`);
  console.log(`   Destination: ${bucketPath}\n`);

  // List available buckets first
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

  if (bucketsError) {
    console.log('❌ Error listing buckets:', bucketsError.message);
    return;
  }

  console.log('Available buckets:');
  buckets.forEach(b => console.log(`   - ${b.name} (${b.public ? 'public' : 'private'})`));
  console.log('');

  // Try uploading to common bucket names
  const possibleBuckets = ['data', 'public', 'assets', 'static'];

  for (const bucketName of possibleBuckets) {
    if (buckets.some(b => b.name === bucketName)) {
      console.log(`🔄 Trying to upload to bucket: ${bucketName}\n`);

      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(bucketPath, fileBuffer, {
          contentType: 'application/json',
          upsert: true
        });

      if (error) {
        console.log(`   ⚠️  Error uploading to ${bucketName}:`, error.message);
        continue;
      }

      console.log(`✅ Successfully uploaded to bucket: ${bucketName}`);
      console.log(`   Path: ${data.path}`);
      console.log(`\n📍 Public URL:`);
      console.log(`   https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/${bucketName}/${bucketPath}`);
      return;
    }
  }

  console.log('❌ Could not find a suitable bucket to upload to.');
  console.log('Please upload manually to the correct bucket.');
}

uploadFile().catch(console.error);
