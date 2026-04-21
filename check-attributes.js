import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function checkAttributes() {
  console.log('🔍 Checking attributes...\n');

  // Check attributes_new table
  const { count: attrCount } = await supabase
    .from('attributes_new')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total attributes in attributes_new: ${attrCount}`);

  // Check a sample
  const { data: sample } = await supabase
    .from('attributes_new')
    .select('*')
    .limit(1)
    .single();

  if (sample) {
    console.log('\n📋 Sample attribute:');
    console.log(JSON.stringify(sample, null, 2));
  }

  // Check for cryptophunksv67 specific attributes file in storage
  console.log('\n🔍 Checking for attributes JSON file in storage...');
  const { data: files } = await supabase.storage
    .from('static')
    .list('data', { limit: 10 });

  if (files) {
    console.log('📂 Files in static/data:');
    files.forEach(f => console.log(`   - ${f.name}`));
  }
}

checkAttributes();
