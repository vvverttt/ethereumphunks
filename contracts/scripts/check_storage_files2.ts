import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://kfnprbhoodmgfhqojmqp.supabase.co',
  (process.env.SUPABASE_KEY || 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe')
);
async function main() {
  const buckets = ['data', 'static', 'attributes', 'mint-images'];
  for (const b of buckets) {
    const { data, error } = await supabase.storage.from(b).list('', { limit: 10 });
    if (error) console.log(b + ': error -', error.message);
    else console.log(b + ':', data?.map((f: any) => f.name));
  }
  // Also check attributes_new table for any etherphunks-like slugs
  const { data: attrs } = await supabase.from('attributes_new').select('slug,tokenId').limit(5);
  console.log('attributes_new sample:', attrs);
}
main();
