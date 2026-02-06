import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabaseUrl = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncOwnership() {
  console.log('🔍 Fetching all QuantumPhunks from database...');

  // Fetch all ethscriptions for cryptophunksv67 (remove default 1000 limit)
  let allEthscriptions = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('ethscriptions')
      .select('hashId, tokenId, sha')
      .eq('slug', 'cryptophunksv67')
      .order('tokenId', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error fetching ethscriptions:', error);
      return;
    }

    if (!data || data.length === 0) break;
    allEthscriptions = allEthscriptions.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  const ethscriptions = allEthscriptions;

  console.log(`📊 Found ${ethscriptions.length} ethscriptions`);
  console.log('⚡ Fetching ownership data from Ethscriptions API...\n');

  let synced = 0;
  let errors = 0;
  let notFound = 0;
  const batchSize = 1; // Process one at a time to avoid rate limits

  for (let i = 0; i < ethscriptions.length; i += batchSize) {
    const batch = ethscriptions.slice(i, i + batchSize);

    // Process batch in parallel with delay between batches
    const results = await Promise.all(
      batch.map(async (item) => {
        try {
          // Fetch from Ethscriptions API v2
          const response = await fetch(`https://api.ethscriptions.com/v2/ethscriptions/${item.hashId}`);

          if (response.status === 404) {
            notFound++;
            return { success: false, tokenId: item.tokenId, reason: 'not_found' };
          }

          if (!response.ok) {
            errors++;
            return { success: false, tokenId: item.tokenId, reason: response.statusText };
          }

          const data = await response.json();

          // Update owner in database
          const { error: updateError } = await supabase
            .from('ethscriptions')
            .update({
              owner: data.current_owner.toLowerCase(),
              creator: data.creator.toLowerCase(),
              createdAt: new Date(data.creation_timestamp).toISOString()
            })
            .eq('hashId', item.hashId);

          if (updateError) {
            errors++;
            return { success: false, tokenId: item.tokenId, reason: updateError.message };
          }

          synced++;
          return { success: true, tokenId: item.tokenId };
        } catch (err) {
          errors++;
          return { success: false, tokenId: item.tokenId, reason: err.message };
        }
      })
    );

    // Progress update
    const progress = Math.min(i + batchSize, ethscriptions.length);
    const percentage = ((progress / ethscriptions.length) * 100).toFixed(1);
    console.log(`   ⏳ Processed ${progress}/${ethscriptions.length} (${percentage}%) - Synced: ${synced}, Not Found: ${notFound}, Errors: ${errors}`);

    // Rate limit: longer delay between requests to avoid 429 errors
    if (i + batchSize < ethscriptions.length) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  console.log('\n✨ Sync complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   Total: ${ethscriptions.length}`);
  console.log(`   Successfully synced: ${synced}`);
  console.log(`   Not found in API: ${notFound}`);
  console.log(`   Errors: ${errors}`);

  if (synced > 0) {
    console.log('\n🔄 Verifying database updates...');
    const { data: updated, count } = await supabase
      .from('ethscriptions')
      .select('owner', { count: 'exact' })
      .eq('slug', 'cryptophunksv67')
      .not('owner', 'is', null);

    console.log(`✅ ${count} ethscriptions now have owner data!`);
  }
}

syncOwnership().catch(console.error);
