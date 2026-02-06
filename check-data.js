import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function checkData() {
  // Get a sample item with owner data
  const { data: sample } = await supabase
    .from('ethscriptions')
    .select('*')
    .eq('slug', 'cryptophunksv67')
    .not('owner', 'is', null)
    .limit(1)
    .single();

  console.log('📋 Sample item with owner data:');
  console.log(JSON.stringify(sample, null, 2));

  // Get a sample item without owner data
  const { data: noOwner } = await supabase
    .from('ethscriptions')
    .select('*')
    .eq('slug', 'cryptophunksv67')
    .is('owner', null)
    .limit(1)
    .single();

  console.log('\n📋 Sample item WITHOUT owner data:');
  console.log(JSON.stringify(noOwner, null, 2));

  // Check counts
  const { count: withOwner } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('slug', 'cryptophunksv67')
    .not('owner', 'is', null);

  const { count: total } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('slug', 'cryptophunksv67');

  console.log(`\n📊 Stats:`);
  console.log(`   With owner: ${withOwner}/${total}`);
  console.log(`   Without owner: ${total - withOwner}`);
}

checkData();
