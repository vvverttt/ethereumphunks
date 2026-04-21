import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabaseUrl = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const supabaseServiceKey = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function populateOwners() {
  let totalUpdated = 0;
  let totalApiErrors = 0;
  let totalDbErrors = 0;
  let batchNumber = 0;

  while (true) {
    batchNumber++;
    console.log(`\n🔄 Batch ${batchNumber}: Fetching items without owner data...\n`);

    // Get next batch of items with NULL owner (Supabase limit: 1000)
    const { data: items } = await supabase
      .from('ethscriptions')
      .select('hashId, tokenId, sha')
      .eq('slug', 'cryptophunksv67')
      .is('owner', null)
      .order('tokenId')
      .limit(1000);

    if (!items || items.length === 0) {
      console.log('\n✅ All items now have owner data!');
      break;
    }

    console.log(`📊 Batch ${batchNumber}: Found ${items.length} items to process\n`);

    let updated = 0;
    let apiErrors = 0;
    let dbErrors = 0;

  for (const item of items) {
    try {
      // Fetch from Ethscriptions API
      const response = await fetch(`https://api.ethscriptions.com/v2/ethscriptions/${item.hashId}`);

      if (!response.ok) {
        console.log(`   ⚠️  Token #${item.tokenId}: API error ${response.status}`);
        apiErrors++;
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      const data = await response.json();
      const ethscription = data.result; // API returns data under 'result' key

      if (!ethscription || !ethscription.current_owner) {
        console.log(`   ⚠️  Token #${item.tokenId}: No owner data in API response`);
        apiErrors++;
        continue;
      }

      // Update database directly
      const { error } = await supabase
        .from('ethscriptions')
        .update({
          owner: ethscription.current_owner.toLowerCase(),
          creator: ethscription.creator.toLowerCase()
        })
        .eq('hashId', item.hashId);

      if (error) {
        console.log(`   ❌ Token #${item.tokenId}: DB error - ${error.message}`);
        dbErrors++;
      } else {
        updated++;
        if (updated % 50 === 0) {
          console.log(`   ✅ Progress: ${updated}/${items.length} updated`);
        }
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (err) {
      console.log(`   ❌ Token #${item.tokenId}: ${err.message}`);
      apiErrors++;
    }
  }

  totalUpdated += updated;
  totalApiErrors += apiErrors;
  totalDbErrors += dbErrors;

  console.log(`\n✨ Batch ${batchNumber} Complete!`);
  console.log(`   Updated: ${updated}/${items.length}`);
  console.log(`   API errors: ${apiErrors}`);
  console.log(`   DB errors: ${dbErrors}`);
  console.log(`\n📊 Overall Progress:`);
  console.log(`   Total updated so far: ${totalUpdated}`);
  console.log(`   Total API errors: ${totalApiErrors}`);
  console.log(`   Total DB errors: ${totalDbErrors}`);

  // Brief pause between batches
  await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n\n🎉 ALL DONE!');
  console.log(`📊 Final Summary:`);
  console.log(`   Total items updated: ${totalUpdated}`);
  console.log(`   Total API errors: ${totalApiErrors}`);
  console.log(`   Total DB errors: ${totalDbErrors}`);
}

populateOwners().catch(console.error);
