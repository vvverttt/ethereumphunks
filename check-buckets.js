import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function checkBuckets() {
  console.log('🔍 Checking Supabase storage buckets...\n');

  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    console.log('❌ Error:', error);
    return;
  }

  console.log('📦 Available buckets:');
  buckets.forEach(bucket => {
    console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
  });

  // Check files in mint-images
  console.log('\n📂 Files in mint-images bucket (first 5):');
  const { data: files, error: filesError } = await supabase.storage
    .from('mint-images')
    .list('', { limit: 5 });

  if (filesError) {
    console.log('   ❌ Error:', filesError);
  } else {
    files.forEach(file => console.log(`   - ${file.name}`));
  }
}

checkBuckets();
