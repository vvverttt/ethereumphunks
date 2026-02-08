const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkAllSlugs() {
  console.log('📊 Fetching all slugs from attributes_new (with pagination)...\n');

  const allSlugs = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('attributes_new')
      .select('slug')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error:', error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    allSlugs.push(...data.map(item => item.slug));
    console.log(`   Page ${page + 1}: fetched ${data.length} records (total so far: ${allSlugs.length})`);

    hasMore = data.length === pageSize;
    page++;
  }

  console.log(`\n✅ Total slugs fetched: ${allSlugs.length}\n`);

  // Count occurrences
  const slugCounts = {};
  allSlugs.forEach(slug => {
    const key = slug === null ? 'NULL' : (slug === '' ? 'EMPTY' : slug);
    slugCounts[key] = (slugCounts[key] || 0) + 1;
  });

  console.log('Slug distribution in attributes_new:');
  Object.entries(slugCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([slug, count]) => {
      console.log(`   ${slug}: ${count} items`);
    });
}

checkAllSlugs().catch(console.error);
