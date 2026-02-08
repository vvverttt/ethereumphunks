const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function checkNullSlugs() {
  console.log('📊 Checking for NULL or different slugs in attributes_new...\n');

  // Check for NULL slugs
  const { data: nullData, error: nullError, count: nullCount } = await supabase
    .from('attributes_new')
    .select('*', { count: 'exact' })
    .is('slug', null)
    .limit(5);

  if (!nullError) {
    console.log(`NULL slugs: ${nullCount} items`);
    if (nullData && nullData.length > 0) {
      console.log('Sample NULL slug record:');
      console.log(JSON.stringify(nullData[0], null, 2));
    }
  }

  // Check for empty string slugs
  const { data: emptyData, error: emptyError, count: emptyCount } = await supabase
    .from('attributes_new')
    .select('*', { count: 'exact' })
    .eq('slug', '')
    .limit(5);

  if (!emptyError) {
    console.log(`\nEmpty string slugs: ${emptyCount} items`);
    if (emptyData && emptyData.length > 0) {
      console.log('Sample empty slug record:');
      console.log(JSON.stringify(emptyData[0], null, 2));
    }
  }

  // Get all distinct slugs
  console.log('\n📊 Getting distinct slugs...');
  const { data: allData, error: allError } = await supabase
    .from('attributes_new')
    .select('slug');

  if (!allError && allData) {
    const slugSet = new Set(allData.map(item => item.slug === null ? 'NULL' : (item.slug === '' ? 'EMPTY' : item.slug)));
    console.log('\nAll distinct slugs:');
    Array.from(slugSet).forEach(slug => {
      const count = allData.filter(item => {
        const itemSlug = item.slug === null ? 'NULL' : (item.slug === '' ? 'EMPTY' : item.slug);
        return itemSlug === slug;
      }).length;
      console.log(`   ${slug}: ${count} items`);
    });
    console.log(`\nTotal records: ${allData.length}`);
  }
}

checkNullSlugs().catch(console.error);
