import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
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
