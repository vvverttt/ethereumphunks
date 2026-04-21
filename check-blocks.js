import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
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
