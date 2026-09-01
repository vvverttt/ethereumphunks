import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://kfnprbhoodmgfhqojmqp.supabase.co',
  (process.env.SUPABASE_KEY || 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe')
);
async function main() {
  const tables = ['ethscriptions', 'ethscriptions_mainnet', 'phunks', 'etherphunks', 'og_phunks', 'collections'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) console.log(t + ': OK, sample:', JSON.stringify(data?.[0]).slice(0, 100));
    else console.log(t + ': ' + error.message);
  }
}
main();
