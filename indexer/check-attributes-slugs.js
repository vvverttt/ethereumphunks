const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkSlugs() {
  console.log('📊 Checking slugs in attributes_new table...\n');

  const { data, error } = await supabase
    .from('attributes_new')
    .select('slug');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  // Count occurrences of each slug
  const slugCounts = {};
  data.forEach(item => {
    const slug = item.slug || 'null';
    slugCounts[slug] = (slugCounts[slug] || 0) + 1;
  });

  console.log('Slugs in attributes_new table:');
  Object.entries(slugCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([slug, count]) => {
      console.log(`   ${slug}: ${count} items`);
    });

  console.log(`\nTotal: ${data.length} items`);

  // Check ethscriptions table slugs for comparison
  const { data: ethData, error: ethError } = await supabase
    .from('ethscriptions')
    .select('slug');

  if (!ethError && ethData) {
    const ethSlugs = {};
    ethData.forEach(item => {
      const slug = item.slug || 'null';
      ethSlugs[slug] = (ethSlugs[slug] || 0) + 1;
    });

    console.log('\n📊 For comparison, ethscriptions table slugs:');
    Object.entries(ethSlugs)
      .sort((a, b) => b[1] - a[1])
      .forEach(([slug, count]) => {
        console.log(`   ${slug}: ${count} items`);
      });
  }
}

checkSlugs().catch(console.error);
