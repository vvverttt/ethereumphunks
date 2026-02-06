import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function checkTableStatus() {
  console.log('🔍 Checking attributes_new table status...\n');

  try {
    const { data, error, count } = await supabase
      .from('attributes_new')
      .select('*', { count: 'exact', head: true })
      .eq('slug', 'cryptophunksv67');

    if (error) {
      console.log('❌ Table does not exist or error accessing it:');
      console.log(`   ${error.message}\n`);
      console.log('📋 Next step: Create the table in Supabase SQL Editor');
      console.log('   Go to: https://supabase.com/dashboard/project/hzpwkpjxhtpcygrwtwku/editor\n');
      return;
    }

    console.log('✅ Table exists!');
    console.log(`   Total rows for cryptophunksv67: ${count}\n`);

    if (count === 0) {
      console.log('📋 Next step: Run the restore script');
      console.log('   Command: node restore-attributes-correct-format.js\n');
    } else if (count < 4337) {
      console.log('⚠️  Table has data but incomplete');
      console.log(`   Expected: 4337, Got: ${count}`);
      console.log('   You may need to delete existing data and re-run restore\n');
    } else {
      console.log('✅ Table is fully populated!');

      // Show sample row
      const { data: sample } = await supabase
        .from('attributes_new')
        .select('sha, values, slug, tokenId')
        .eq('slug', 'cryptophunksv67')
        .limit(1)
        .single();

      if (sample) {
        console.log('\n📝 Sample row:');
        console.log(`   sha: ${sample.sha?.substring(0, 20)}...`);
        console.log(`   values: ${JSON.stringify(sample.values).substring(0, 100)}...`);
        console.log(`   slug: ${sample.slug}`);
        console.log(`   tokenId: ${sample.tokenId}`);
      }
    }
  } catch (e) {
    console.log('❌ Error:', e.message);
  }
}

checkTableStatus().catch(console.error);
