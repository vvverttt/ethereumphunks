import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
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
