import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://kfnprbhoodmgfhqojmqp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbnByYmhvb2RtZ2ZocW9qbXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTM1NTYsImV4cCI6MjA4OTQ4OTU1Nn0.jum-NTWlLJnxmbxe9foylgrEMhGrhn34IPxd4aiyTSE'
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
