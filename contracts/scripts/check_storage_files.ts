import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://kfnprbhoodmgfhqojmqp.supabase.co',
  (process.env.SUPABASE_KEY || 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe')
);
async function main() {
  const { data } = await supabase.storage.from('data').list('');
  console.log('data bucket files:', data?.map((f: any) => f.name));
}
main();
