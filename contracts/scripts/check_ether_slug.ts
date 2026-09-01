import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://kfnprbhoodmgfhqojmqp.supabase.co',
  (process.env.SUPABASE_KEY || 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe')
);
async function main() {
  const { data } = await supabase.from('ethscriptions').select('slug').eq('slug', 'ethereumphunks').limit(3);
  console.log('ethereumphunks:', data);
  const { data: data2 } = await supabase.from('ethscriptions').select('slug').ilike('slug', '%ether%').limit(3);
  console.log('ilike ether%:', data2);
}
main();
