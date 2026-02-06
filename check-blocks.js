import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function checkBlocks() {
  // Check a sample item to see all columns
  const { data, error } = await supabase
    .from('ethscriptions')
    .select('*')
    .eq('slug', 'cryptophunksv67')
    .limit(3);

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log('Sample item structure:');
  console.log(JSON.stringify(data[0], null, 2));

  // Check for items with createdAt
  const { data: withCreated } = await supabase
    .from('ethscriptions')
    .select('tokenId, createdAt, owner, creator')
    .eq('slug', 'cryptophunksv67')
    .not('createdAt', 'is', null)
    .order('createdAt', { ascending: false })
    .limit(5);

  console.log('\nRecent items by createdAt:');
  console.log(withCreated);
}

checkBlocks();
