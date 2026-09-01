import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://kfnprbhoodmgfhqojmqp.supabase.co',
  (process.env.SUPABASE_KEY || 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe')
);
async function main() {
  let offset = 0;
  const slugs = new Set<string>();
  while (true) {
    const { data } = await supabase.from('ethscriptions').select('slug').range(offset, offset + 999);
    if (!data?.length) break;
    data.forEach((d: any) => slugs.add(d.slug));
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log('all slugs in ethscriptions:', [...slugs]);
}
main();
