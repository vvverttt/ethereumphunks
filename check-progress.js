import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
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
