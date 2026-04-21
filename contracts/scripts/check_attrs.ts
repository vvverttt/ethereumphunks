import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://kfnprbhoodmgfhqojmqp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbnByYmhvb2RtZ2ZocW9qbXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTM1NTYsImV4cCI6MjA4OTQ4OTU1Nn0.jum-NTWlLJnxmbxe9foylgrEMhGrhn34IPxd4aiyTSE'
);
async function main() {
  const { data } = await supabase.from('attributes_new').select('slug').limit(100);
  const unique = [...new Set(data?.map((d: any) => d.slug))];
  console.log('unique slugs in attributes_new:', unique);
}
main();
