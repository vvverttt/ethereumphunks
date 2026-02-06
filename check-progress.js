import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function checkProgress() {
  // Count items with owner data
  const { count: withOwner } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('slug', 'cryptophunksv67')
    .not('owner', 'is', null);

  // Count total items
  const { count: total } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('slug', 'cryptophunksv67');

  console.log(`📊 Progress: ${withOwner}/${total} items have owner data`);
  console.log(`   Remaining: ${total - withOwner}`);
}

checkProgress();
