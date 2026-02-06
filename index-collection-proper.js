import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabaseUrl = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const indexerUrl = 'http://localhost:3069';
const apiKey = '75c5d7c962a7ea097f3f6c7dacb95e20afc6aa62de20a8ca04a0973cfecba0f5';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function indexCollection() {
  console.log('🚀 Proper collection indexing using Ethscriptions API + reindex-transaction\n');

  // 1. Fetch all ethscriptions
  console.log('1️⃣ Fetching ethscriptions from database...');
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

    if (error || !data || data.length === 0) break;
    allEthscriptions = allEthscriptions.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`   ✅ Found ${allEthscriptions.length} ethscriptions\n`);

  // 2. Collect all transactions with block numbers from Ethscriptions API
  console.log('2️⃣ Fetching transaction details from Ethscriptions API...');
  const transactions = [];
  let apiErrors = 0;

  for (let i = 0; i < allEthscriptions.length; i++) {
    const item = allEthscriptions[i];

    try {
      const response = await fetch(`https://api.ethscriptions.com/v2/ethscriptions/${item.hashId}`);

      if (!response.ok) {
        apiErrors++;
        if (apiErrors <= 10) {
          console.log(`   ⚠️  Token #${item.tokenId}: API error ${response.status}`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay on error
        continue;
      }

      const data = await response.json();

      // Add initial creation transaction
      transactions.push({
        hash: item.hashId,
        blockNumber: data.block_number,
        tokenId: item.tokenId,
        type: 'creation'
      });

      // Add any transfer transactions
      if (data.previous_owner) {
        // There was at least one transfer - would need to get full history
        // For now, just index the creation transaction
      }

      if ((i + 1) % 50 === 0) {
        console.log(`   ⏳ Processed ${i + 1}/${allEthscriptions.length} - Collected: ${transactions.length}, Errors: ${apiErrors}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (err) {
      apiErrors++;
      console.log(`   ❌ Token #${item.tokenId}: ${err.message}`);
    }
  }

  console.log(`\n   ✅ Collected ${transactions.length} transactions\n`);

  // 3. Sort by block number
  console.log('3️⃣ Sorting transactions by block number...');
  transactions.sort((a, b) => a.blockNumber - b.blockNumber);
  console.log(`   ✅ Sorted from block ${transactions[0]?.blockNumber} to ${transactions[transactions.length - 1]?.blockNumber}\n`);

  // 4. Submit each transaction to reindex-transaction endpoint
  console.log('4️⃣ Submitting transactions to indexer...');
  let indexed = 0;
  let indexErrors = 0;

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];

    try {
      const response = await fetch(`${indexerUrl}/admin/reindex-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({ hash: tx.hash })
      });

      if (response.ok) {
        indexed++;
      } else {
        indexErrors++;
        if (indexErrors <= 10) {
          console.log(`   ❌ Token #${tx.tokenId}: Indexer error ${response.status}`);
        }
      }

      if ((i + 1) % 10 === 0 || i === transactions.length - 1) {
        console.log(`   ⏳ Indexed ${i + 1}/${transactions.length} - Success: ${indexed}, Errors: ${indexErrors}`);
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (err) {
      indexErrors++;
      console.log(`   ❌ Token #${tx.tokenId}: ${err.message}`);
    }
  }

  console.log('\n✨ Indexing Complete!');
  console.log(`📊 Summary:`);
  console.log(`   Total ethscriptions: ${allEthscriptions.length}`);
  console.log(`   Transactions collected: ${transactions.length}`);
  console.log(`   Successfully indexed: ${indexed}`);
  console.log(`   API errors: ${apiErrors}`);
  console.log(`   Indexer errors: ${indexErrors}`);
}

indexCollection().catch(console.error);
