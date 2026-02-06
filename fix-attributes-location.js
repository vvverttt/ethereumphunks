import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function fixLocation() {
  console.log('🔧 Moving attributes file to correct location...\n');

  // 1. Create 'data' bucket if needed
  const { data: buckets } = await supabase.storage.listBuckets();

  if (!buckets.some(b => b.name === 'data')) {
    console.log('Creating "data" bucket...');
    await supabase.storage.createBucket('data', { public: true });
    console.log('✅ Created "data" bucket\n');
  } else {
    console.log('✅ "data" bucket exists\n');
  }

  // 2. Download from current location
  console.log('Downloading attributes from static/data/...');
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('static')
    .download('data/cryptophunksv67_attributes.json');

  if (downloadError) {
    console.log('❌ Error:', downloadError);
    return;
  }

  console.log('✅ Downloaded successfully\n');

  // 3. Upload to new location (data bucket root)
  console.log('Uploading to data/cryptophunksv67_attributes.json...');
  const { error: uploadError } = await supabase.storage
    .from('data')
    .upload('cryptophunksv67_attributes.json', fileData, {
      contentType: 'application/json',
      upsert: true,
    });

  if (uploadError) {
    console.log('❌ Error:', uploadError);
    return;
  }

  console.log('✅ Uploaded successfully\n');

  // 4. Get public URL
  const { data: publicUrl } = supabase.storage
    .from('data')
    .getPublicUrl('cryptophunksv67_attributes.json');

  console.log('✨ Complete!');
  console.log('🌐 New URL:', publicUrl.publicUrl);
}

fixLocation().catch(console.error);
