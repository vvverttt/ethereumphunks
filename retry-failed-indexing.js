import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import fs from 'fs';

const supabaseUrl = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const indexerUrl = 'http://localhost:3069';
const apiKey = '75c5d7c962a7ea097f3f6c7dacb95e20afc6aa62de20a8ca04a0973cfecba0f5';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Load failed token IDs from file
const failedTokenIds = fs.readFileSync('failed-tokens.txt', 'utf-8')
  .trim()
  .split('\n')
  .map(line => parseInt(line.trim()))
  .filter(n => !isNaN(n));

async function retryFailed() {
  console.log(`🔄 Retrying ${failedTokenIds.length} failed tokens...\n`);

  // Fetch the failed ethscriptions
  const { data: items } = await supabase
    .from('ethscriptions')
    .select('hashId, tokenId, sha')
    .eq('slug', 'cryptophunksv67')
    .in('tokenId', failedTokenIds);

  if (!items || items.length === 0) {
    console.log('❌ No items found for the failed token IDs');
    return;
  }

  console.log(`✅ Found ${items.length} items to retry\n`);

  const transactions = [];
  let apiErrors = 0;
  let apiSuccess = 0;

  // Retry fetching from Ethscriptions API
  for (const item of items) {
    console.log(`🔍 Retrying Token #${item.tokenId}...`);

    try {
      const response = await fetch(`https://api.ethscriptions.com/v2/ethscriptions/${item.hashId}`);

      if (!response.ok) {
        console.log(`   ⚠️  API error ${response.status}`);
        apiErrors++;
        await new Promise(resolve => setTimeout(resolve, 3000)); // Longer delay on error
        continue;
      }

      const data = await response.json();

      transactions.push({
        hash: item.hashId,
        blockNumber: data.block_number,
        tokenId: item.tokenId,
        type: 'creation'
      });

      apiSuccess++;
      console.log(`   ✅ Collected successfully`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting

    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      apiErrors++;
    }
  }

  console.log(`\n📊 API Results: Success: ${apiSuccess}, Errors: ${apiErrors}\n`);

  if (transactions.length === 0) {
    console.log('❌ No transactions to submit');
    return;
  }

  // Submit to indexer
  console.log(`4️⃣ Submitting ${transactions.length} transactions to indexer...\n`);

  let indexed = 0;
  let indexErrors = 0;

  for (const tx of transactions) {
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
        console.log(`   ✅ Token #${tx.tokenId}: Indexed`);
      } else {
        indexErrors++;
        console.log(`   ❌ Token #${tx.tokenId}: Indexer error ${response.status}`);
      }

      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (err) {
      indexErrors++;
      console.log(`   ❌ Token #${tx.tokenId}: ${err.message}`);
    }
  }

  console.log('\n✨ Retry Complete!');
  console.log(`📊 Summary:`);
  console.log(`   API Success: ${apiSuccess}/${failedTokenIds.length}`);
  console.log(`   Successfully indexed: ${indexed}/${transactions.length}`);
  console.log(`   Indexer errors: ${indexErrors}`);
}

retryFailed().catch(console.error);
