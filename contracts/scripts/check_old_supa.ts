import { createClient } from '@supabase/supabase-js';
// Old supabase project
const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  (process.env.SUPABASE_KEY || '')
);
async function main() {
  const { data, error } = await supabase
    .from('ethscriptions')
    .select('hashId,sha,tokenId,owner,slug')
    .eq('slug', 'ethereumphunks')
    .limit(5);
  console.log('error:', error?.message);
  console.log('sample:', data);
  const { count } = await supabase
    .from('ethscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('slug', 'ethereumphunks');
  console.log('total count:', count);
}
main();
