import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const supabaseUrl = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth-mainnet.g.alchemy.com/v2/C2mkwU9xTr2HarApFpqbO')
});

async function test5Items() {
  console.log('🔍 Fetching first 5 ethscriptions...\n');

  const { data, error } = await supabase
    .from('ethscriptions')
    .select('hashId, tokenId')
    .eq('slug', 'cryptophunksv67')
    .order('tokenId', { ascending: true })
    .limit(5);

  if (error) {
    console.error('❌ Database error:', error);
    return;
  }

  console.log(`📊 Testing ${data.length} items:\n`);

  let updated = 0;
  let errors = 0;

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    console.log(`\n--- Token #${item.tokenId} ---`);
    console.log(`Hash: ${item.hashId}`);

    try {
      console.log('  Fetching transaction...');
      const tx = await client.getTransaction({ hash: item.hashId });

      if (tx) {
        console.log(`  ✅ Transaction found!`);
        console.log(`  From: ${tx.from}`);
        console.log(`  Block: ${tx.blockNumber}`);

        console.log('  Fetching block...');
        const block = await client.getBlock({ blockNumber: tx.blockNumber });
        const timestamp = new Date(Number(block.timestamp) * 1000).toISOString();
        console.log(`  Timestamp: ${timestamp}`);

        console.log('  Updating database...');
        const { error: updateError } = await supabase
          .from('ethscriptions')
          .update({
            creator: tx.from.toLowerCase(),
            owner: tx.from.toLowerCase(),
            createdAt: timestamp
          })
          .eq('hashId', item.hashId);

        if (updateError) {
          errors++;
          console.log(`  ❌ DB error:`, updateError);
        } else {
          updated++;
          console.log(`  ✅ Updated successfully!`);
        }
      } else {
        errors++;
        console.log(`  ❌ Transaction not found (returned null)`);
      }
    } catch (err) {
      errors++;
      console.log(`  ❌ Error:`, err.message);
      console.log(`  Full error:`, err);
    }

    // Small delay
    if (i < data.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n\n✨ Test Complete!');
  console.log(`📊 Summary: ${updated} updated, ${errors} errors`);
}

test5Items().catch(console.error);
