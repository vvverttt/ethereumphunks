import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function reorganizeImages() {
  console.log('🔄 Reorganizing images to correct structure...\n');

  // 1. Create 'static' bucket if it doesn't exist
  console.log('1️⃣ Setting up storage buckets...');
  const { data: buckets } = await supabase.storage.listBuckets();

  if (!buckets.some(b => b.name === 'static')) {
    console.log('   Creating "static" bucket...');
    const { error } = await supabase.storage.createBucket('static', {
      public: true,
      fileSizeLimit: 52428800, // 50MB
    });
    if (error) {
      console.log('   ❌ Error:', error);
      return;
    }
    console.log('   ✅ Created "static" bucket');
  } else {
    console.log('   ✅ "static" bucket exists');
  }

  // 2. Get all ethscriptions with tokenId and sha mapping
  console.log('\n2️⃣ Fetching ethscriptions from database...');
  let allEthscriptions = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('ethscriptions')
      .select('tokenId, sha')
      .eq('slug', 'cryptophunksv67')
      .order('tokenId', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('   ❌ Error:', error);
      return;
    }

    if (!data || data.length === 0) break;
    allEthscriptions = allEthscriptions.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`   ✅ Found ${allEthscriptions.length} ethscriptions`);

  // 3. Copy images from mint-images/cryptophunksv67/{tokenId}.png to static/images/{sha}
  console.log('\n3️⃣ Copying images to new structure...');
  let copied = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < allEthscriptions.length; i++) {
    const item = allEthscriptions[i];
    const sourcePath = `cryptophunksv67/${item.tokenId}.png`;
    const destPath = `images/${item.sha}`;

    try {
      // Download from source
      const { data: imageData, error: downloadError } = await supabase.storage
        .from('mint-images')
        .download(sourcePath);

      if (downloadError) {
        if (downloadError.message.includes('not found')) {
          skipped++;
        } else {
          errors++;
          console.log(`   ❌ Token #${item.tokenId}: Download error`);
        }
        continue;
      }

      // Upload to destination (without .png extension)
      const { error: uploadError } = await supabase.storage
        .from('static')
        .upload(destPath, imageData, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        errors++;
        console.log(`   ❌ Token #${item.tokenId}: Upload error`);
      } else {
        copied++;
      }
    } catch (err) {
      errors++;
      console.log(`   ❌ Token #${item.tokenId}: ${err.message}`);
    }

    // Progress
    if ((i + 1) % 100 === 0 || i === allEthscriptions.length - 1) {
      const percentage = (((i + 1) / allEthscriptions.length) * 100).toFixed(1);
      console.log(`   ⏳ Processed ${i + 1}/${allEthscriptions.length} (${percentage}%) - Copied: ${copied}, Skipped: ${skipped}, Errors: ${errors}`);
    }

    // Small delay to avoid rate limits
    if (i < allEthscriptions.length - 1 && i % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log('\n✨ Complete!');
  console.log(`📊 Summary: ${copied} copied, ${skipped} skipped, ${errors} errors`);
  console.log('\n🌐 New image URL format:');
  console.log(`   https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/static/images/{sha}`);
}

reorganizeImages().catch(console.error);
