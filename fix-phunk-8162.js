const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const JSON_FILE_PATH = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\cryptophunks-v67.json';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function fixPhunk8162() {
  console.log('🔍 Checking Phunk #8162...\n');

  // Get current data
  const { data: ethscription } = await supabase
    .from('ethscriptions')
    .select('*')
    .eq('tokenId', 8162)
    .eq('slug', 'cryptophunksv67')
    .single();

  if (!ethscription) {
    console.log('❌ Phunk #8162 not found');
    return;
  }

  console.log('Current ethscription data:');
  console.log(`  tokenId: ${ethscription.tokenId}`);
  console.log(`  hashId: ${ethscription.hashId}`);
  console.log(`  sha: ${ethscription.sha}`);
  console.log(`  creator: ${ethscription.creator}`);
  console.log(`  owner: ${ethscription.owner}\n`);

  // Get event data
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('hashId', ethscription.hashId)
    .eq('type', 'created')
    .single();

  if (event) {
    console.log('Current event data:');
    console.log(`  txHash: ${event.txHash}`);
    console.log(`  txId: ${event.txId}`);
    console.log(`  blockNumber: ${event.blockNumber}`);
    console.log(`  blockTimestamp: ${event.blockTimestamp}\n`);
  }

  // Check JSON file for correct hash
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE_PATH, 'utf8'));
  const jsonItem = jsonData.collection_items.find(item => item.sha === ethscription.sha);

  if (jsonItem) {
    console.log('JSON file data:');
    console.log(`  id (correct txHash): ${jsonItem.id}`);
    console.log(`  created_at: ${jsonItem.created_at}\n`);

    const corrupted = event.txHash;
    const correct = jsonItem.id;

    if (corrupted !== correct) {
      console.log('🔧 Transaction hash mismatch detected!');
      console.log(`  Corrupted: ${corrupted}`);
      console.log(`  Correct:   ${correct}\n`);

      console.log('Fixing...\n');

      // Update ethscription hashId
      const { error: ethError } = await supabase
        .from('ethscriptions')
        .update({ hashId: correct })
        .eq('tokenId', 8162)
        .eq('slug', 'cryptophunksv67');

      if (ethError) {
        console.error('❌ Error updating ethscription:', ethError);
      } else {
        console.log('✅ Updated ethscription hashId');
      }

      // Update event
      const { error: eventError } = await supabase
        .from('events')
        .update({
          txHash: correct,
          hashId: correct,
          txId: correct + '-0-0'
        })
        .eq('hashId', corrupted)
        .eq('type', 'created');

      if (eventError) {
        console.error('❌ Error updating event:', eventError);
      } else {
        console.log('✅ Updated event txHash and hashId');
      }

      // Now fetch real blockchain data for the correct hash
      console.log('\n🔄 Fetching real blockchain data for correct hash...\n');

      const { createPublicClient, http } = require('viem');
      const { mainnet } = require('viem/chains');

      const client = createPublicClient({
        chain: mainnet,
        transport: http('https://eth-mainnet.g.alchemy.com/v2/C2mkwU9xTr2HarApFpqbO')
      });

      try {
        const tx = await client.getTransaction({ hash: correct });
        const block = await client.getBlock({ blockNumber: tx.blockNumber });

        const blockData = {
          blockNumber: Number(tx.blockNumber),
          blockHash: tx.blockHash,
          blockTimestamp: new Date(Number(block.timestamp) * 1000),
          txIndex: tx.transactionIndex
        };

        console.log('Blockchain data:');
        console.log(`  blockNumber: ${blockData.blockNumber}`);
        console.log(`  blockHash: ${blockData.blockHash}`);
        console.log(`  blockTimestamp: ${blockData.blockTimestamp.toISOString()}`);
        console.log(`  txIndex: ${blockData.txIndex}\n`);

        // Update event with real blockchain data
        const { error: updateError } = await supabase
          .from('events')
          .update({
            blockNumber: blockData.blockNumber,
            blockHash: blockData.blockHash,
            blockTimestamp: blockData.blockTimestamp,
            txIndex: blockData.txIndex
          })
          .eq('hashId', correct)
          .eq('type', 'created');

        if (updateError) {
          console.error('❌ Error updating blockchain data:', updateError);
        } else {
          console.log('✅ Updated event with real blockchain data');
        }

        console.log('\n🎉 Phunk #8162 fixed successfully!');
      } catch (error) {
        console.error('❌ Error fetching blockchain data:', error.message);
      }
    } else {
      console.log('✅ Transaction hash is correct, no fix needed');
    }
  } else {
    console.log('⚠️  Item not found in JSON file');
  }
}

fixPhunk8162();
