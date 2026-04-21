const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkSlugs() {
  console.log('📊 Checking all slugs and counts...\n');

  // Get all unique slugs with counts
  const { data, error } = await supabase
    .from('ethscriptions')
    .select('slug')
    .order('slug');

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

  console.log('Collection slugs and counts:');
  Object.entries(slugCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([slug, count]) => {
      console.log(`   ${slug}: ${count} items`);
    });

  console.log(`\nTotal items in database: ${data.length}`);
}

checkSlugs().catch(console.error);
