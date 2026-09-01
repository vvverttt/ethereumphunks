import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://kfnprbhoodmgfhqojmqp.supabase.co',
  (process.env.SUPABASE_KEY || 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe')
);
async function main() {
  const { data } = await supabase.from('ethscriptions').select('slug').order('slug').limit(100);
  const unique = [...new Set(data?.map((d: any) => d.slug))];
  console.log('unique slugs:', unique);
}
main();
