import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabaseUrl = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const indexerUrl = 'http://localhost:3069';
const apiKey = '75c5d7c962a7ea097f3f6c7dacb95e20afc6aa62de20a8ca04a0973cfecba0f5';

async function reindexCollection() {
  console.log('🔍 Fetching all QuantumPhunks transaction hashes...');

  // Fetch all ethscriptions for cryptophunksv67
  const { data: ethscriptions, error } = await supabase
    .from('ethscriptions')
    .select('hashId, tokenId')
    .eq('slug', 'cryptophunksv67')
    .order('tokenId', { ascending: true });

  if (error) {
    console.error('❌ Error fetching ethscriptions:', error);
    return;
  }

  console.log(`📊 Found ${ethscriptions.length} ethscriptions to reindex`);
  console.log('⚡ Starting reindexing process...\n');

  let indexed = 0;
  let errors = 0;
  const batchSize = 10; // Process 10 at a time

  for (let i = 0; i < ethscriptions.length; i += batchSize) {
    const batch = ethscriptions.slice(i, i + batchSize);

    // Process batch in parallel
    const promises = batch.map(async (item) => {
      try {
        const response = await fetch(`${indexerUrl}/admin/reindex-transaction`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify({ hash: item.hashId })
        });

        if (response.ok) {
          indexed++;
          return { success: true, tokenId: item.tokenId };
        } else {
          errors++;
          const errorText = await response.text();
          return { success: false, tokenId: item.tokenId, error: errorText };
        }
      } catch (err) {
        errors++;
        return { success: false, tokenId: item.tokenId, error: err.message };
      }
    });

    await Promise.all(promises);

    // Progress update
    const progress = Math.min(i + batchSize, ethscriptions.length);
    const percentage = ((progress / ethscriptions.length) * 100).toFixed(1);
    console.log(`   ⏳ Processed ${progress}/${ethscriptions.length} (${percentage}%) - Success: ${indexed}, Errors: ${errors}`);
  }

  console.log('\n✨ Reindexing complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   Total: ${ethscriptions.length}`);
  console.log(`   Successfully indexed: ${indexed}`);
  console.log(`   Errors: ${errors}`);

  if (indexed > 0) {
    console.log('\n🔄 Checking updated data...');
    const { data: updated } = await supabase
      .from('ethscriptions')
      .select('owner')
      .eq('slug', 'cryptophunksv67')
      .not('owner', 'is', null);

    console.log(`✅ ${updated.length} ethscriptions now have owner data!`);
  }
}

reindexCollection().catch(console.error);
