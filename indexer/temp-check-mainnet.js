const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  (process.env.SUPABASE_KEY || '')
);

async function check() {
  // Check global config for network 1
  const { data: config, error: configErr } = await supabase
    .from('_global_config')
    .select('*')
    .eq('network', 1)
    .limit(5);
  console.log('Global config (network=1):', JSON.stringify(config, null, 2));
  if (configErr) console.log('Config error:', configErr);
  
  // Check comments table (mainnet, no suffix)
  const { data: comments, error: commentsErr } = await supabase
    .from('comments')
    .select('*')
    .limit(10);
  console.log('\nComments table:', JSON.stringify(comments, null, 2));
  if (commentsErr) console.log('Comments error:', commentsErr);

  // Check specifically for comments on the address
  const { data: addrComments, error: addrErr } = await supabase
    .from('comments')
    .select('*')
    .eq('hashId', '0x332d46c602e9f4f9e67b57c443f1b6ca0ee5ab35')
    .limit(10);
  console.log('\nComments for address 0x332d...:', JSON.stringify(addrComments, null, 2));
  if (addrErr) console.log('Address comments error:', addrErr);
}

check();
