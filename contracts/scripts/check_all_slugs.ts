import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://kfnprbhoodmgfhqojmqp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbnByYmhvb2RtZ2ZocW9qbXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTM1NTYsImV4cCI6MjA4OTQ4OTU1Nn0.jum-NTWlLJnxmbxe9foylgrEMhGrhn34IPxd4aiyTSE'
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
