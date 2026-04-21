import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function checkCollection() {
  console.log('🔍 Checking collection configuration...\n');

  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('slug', 'cryptophunksv67')
    .single();

  if (error) {
    console.log('❌ Error:', error);
    return;
  }

  if (!data) {
    console.log('❌ Collection not found!');
    return;
  }

  console.log('✅ Collection found:');
  console.log(JSON.stringify(data, null, 2));
}

checkCollection();
