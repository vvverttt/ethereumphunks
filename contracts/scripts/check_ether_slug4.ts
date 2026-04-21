import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://kfnprbhoodmgfhqojmqp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbnByYmhvb2RtZ2ZocW9qbXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTM1NTYsImV4cCI6MjA4OTQ4OTU1Nn0.jum-NTWlLJnxmbxe9foylgrEMhGrhn34IPxd4aiyTSE'
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
