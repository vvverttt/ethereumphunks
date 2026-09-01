import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://kfnprbhoodmgfhqojmqp.supabase.co',
  (process.env.SUPABASE_KEY || 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe')
);
async function main() {
  const { data } = await supabase.from('attributes_new').select('*').limit(2);
  console.log(JSON.stringify(data, null, 2));
}
main();
