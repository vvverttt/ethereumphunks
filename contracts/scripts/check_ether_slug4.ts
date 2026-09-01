import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://kfnprbhoodmgfhqojmqp.supabase.co',
  (process.env.SUPABASE_KEY || 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe')
);
async function main() {
  // check all tables
  const tables = ['ethscriptions', 'ethscriptions_1', 'nfts', 'tokens'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('slug').limit(2);
    console.log(t + ':', error ? error.message : data);
  }
}
main();
