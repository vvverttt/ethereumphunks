import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const supabaseUrl = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create viem client to read blockchain directly
const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth-mainnet.g.alchemy.com/v2/C2mkwU9xTr2HarApFpqbO')
});

async function populateFromBlockchain() {
  console.log('🔍 Fetching ethscriptions from database...');

  let allEthscriptions = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('ethscriptions')
      .select('hashId, tokenId')
      .eq('slug', 'cryptophunksv67')
      .order('tokenId', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (!data || data.length === 0) break;
    allEthscriptions = allEthscriptions.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`📊 Found ${allEthscriptions.length} ethscriptions`);
  console.log('⚡ Reading from Ethereum blockchain...\n');

  let updated = 0;
  let errors = 0;

  for (let i = 0; i < allEthscriptions.length; i++) {
    const item = allEthscriptions[i];

    try {
      // Fetch transaction directly from Ethereum
      const tx = await client.getTransaction({ hash: item.hashId });

      if (tx) {
        // Get block for timestamp
        const block = await client.getBlock({ blockNumber: tx.blockNumber });

        // Update database with creator (from address) and creation time
        const { error: updateError } = await supabase
          .from('ethscriptions')
          .update({
            creator: tx.from.toLowerCase(),
            owner: tx.from.toLowerCase(), // Initial owner is creator
            createdAt: new Date(Number(block.timestamp) * 1000).toISOString()
          })
          .eq('hashId', item.hashId);

        if (updateError) {
          errors++;
          console.log(`❌ Token #${item.tokenId}: DB error`);
        } else {
          updated++;
        }
      }
    } catch (err) {
      errors++;
      console.log(`❌ Token #${item.tokenId}: ${err.message}`);
    }

    // Progress
    if ((i + 1) % 10 === 0 || i === allEthscriptions.length - 1) {
      const percentage = (((i + 1) / allEthscriptions.length) * 100).toFixed(1);
      console.log(`   ⏳ Processed ${i + 1}/${allEthscriptions.length} (${percentage}%) - Updated: ${updated}, Errors: ${errors}`);
    }

    // Small delay to avoid rate limits
    if (i < allEthscriptions.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log('\n✨ Complete!');
  console.log(`📊 Summary: ${updated} updated, ${errors} errors`);
}

populateFromBlockchain().catch(console.error);
