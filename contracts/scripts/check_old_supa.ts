import { createClient } from '@supabase/supabase-js';
// Old supabase project
const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTI0NzMzNzAsImV4cCI6MjAwODA0OTM3MH0.Oa8mOhNrd16sxFGhCMixCb5lBFBtCL6BqZPZK13t9To'
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
