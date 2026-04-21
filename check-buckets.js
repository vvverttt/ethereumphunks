import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
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
