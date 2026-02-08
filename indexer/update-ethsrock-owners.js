const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const fs = require('fs');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const JSON_FILE = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\EthsRock-with-sha.json';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function main() {
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  const items = jsonData.collection_items;

  console.log('🔄 Updating ownership for', items.length, 'items from ethscriptions API...\n');
  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const res = await axios.get('https://api.ethscriptions.com/v2/ethscriptions/' + item.id);
      const d = res.data.result || res.data;
      const currentOwner = d.current_owner?.toLowerCase();
      const prevOwner = d.previous_owner?.toLowerCase();
      const creator = d.creator?.toLowerCase();

      if (!currentOwner) { errors++; continue; }

      const { error } = await supabase
        .from('ethscriptions')
        .update({
          owner: currentOwner,
          prevOwner: prevOwner || creator,
        })
        .eq('hashId', item.id);

      if (error) {
        console.error('  ❌ DB error for #' + i + ':', error.message);
        errors++;
      } else {
        if (currentOwner !== creator) {
          console.log('  ✅ #' + i + ': transferred → ' + currentOwner.slice(0, 10) + '...');
          updated++;
        } else {
          unchanged++;
        }
      }

      // Rate limit + progress
      if ((i + 1) % 10 === 0) {
        console.log('  📊 Progress: ' + (i + 1) + '/' + items.length);
        await new Promise(r => setTimeout(r, 200));
      } else {
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      console.error('  ❌ API error for #' + i + ':', err.message);
      errors++;
    }
  }

  console.log('\n🎉 Done!');
  console.log('   Transferred (updated): ' + updated);
  console.log('   Still with creator (unchanged): ' + unchanged);
  console.log('   Errors: ' + errors);
}

main().catch(err => { console.error('💥 Fatal:', err); process.exit(1); });
