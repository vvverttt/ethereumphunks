const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkCollectionDetails() {
  console.log('🔍 Checking collection details...\n');

  const { data: collection } = await supabase
    .from('collections')
    .select('*')
    .eq('slug', 'cryptophunksv67')
    .single();

  if (!collection) {
    console.log('❌ Collection not found!');
    return;
  }

  console.log('📊 QuantumPhunks Collection:\n');
  console.log('Fields:');
  Object.entries(collection).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      console.log(`   ${key}: ⚠️  NOT SET`);
    } else if (typeof value === 'string' && value.length > 100) {
      console.log(`   ${key}: ${value.substring(0, 100)}...`);
    } else {
      console.log(`   ${key}: ${value}`);
    }
  });

  console.log('\n\n✅ Required fields for dropdown:');
  console.log(`   name: ${collection.name ? '✅' : '❌ Missing'}`);
  console.log(`   slug: ${collection.slug ? '✅' : '❌ Missing'}`);
  console.log(`   image: ${collection.image ? '✅' : '❌ Missing'}`);

  if (!collection.image) {
    console.log('\n⚠️  Image is missing! The dropdown needs an image.');
    console.log('   Add an image URL to the collection.');
  }

  console.log('\n\n📝 To update collection image:');
  console.log(`
  UPDATE collections
  SET image = 'https://your-image-url.com/quantumphunks.png',
      description = 'Your collection description',
      banner = 'https://your-banner-url.com/banner.png'
  WHERE slug = 'cryptophunksv67';
  `);
}

checkCollectionDetails();
