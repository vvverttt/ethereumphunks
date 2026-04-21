import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://kfnprbhoodmgfhqojmqp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbnByYmhvb2RtZ2ZocW9qbXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTM1NTYsImV4cCI6MjA4OTQ4OTU1Nn0.jum-NTWlLJnxmbxe9foylgrEMhGrhn34IPxd4aiyTSE'
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
