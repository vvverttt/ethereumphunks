const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

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
