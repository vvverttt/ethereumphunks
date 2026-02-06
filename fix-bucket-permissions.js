import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function fixBucketPermissions() {
  console.log('🔧 Checking and fixing bucket permissions...\n');

  // Check current bucket settings
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.log('❌ Error listing buckets:', listError);
    return;
  }

  console.log('📦 Current buckets:');
  buckets.forEach(b => {
    console.log(`   - ${b.name}: ${b.public ? 'PUBLIC' : 'PRIVATE'}`);
  });

  // Update static bucket to be public
  const staticBucket = buckets.find(b => b.name === 'static');

  if (staticBucket && !staticBucket.public) {
    console.log('\n🔓 Making static bucket public...');

    const { error: updateError } = await supabase.storage.updateBucket('static', {
      public: true
    });

    if (updateError) {
      console.log('❌ Error:', updateError);
    } else {
      console.log('✅ Static bucket is now public');
    }
  } else if (staticBucket && staticBucket.public) {
    console.log('\n✅ Static bucket is already public');
  }

  // Test file access
  console.log('\n🌐 Testing file access...');
  const { data: publicUrl } = supabase.storage
    .from('static')
    .getPublicUrl('data/cryptophunksv67_attributes.json');

  console.log('URL:', publicUrl.publicUrl);

  // Try to fetch it
  try {
    const response = await fetch(publicUrl.publicUrl);
    if (response.ok) {
      console.log('✅ File is accessible!');
    } else {
      console.log(`❌ File not accessible: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.log('❌ Fetch error:', err.message);
  }
}

fixBucketPermissions().catch(console.error);
