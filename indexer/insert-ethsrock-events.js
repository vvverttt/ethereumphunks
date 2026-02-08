const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const SLUG = 'ethsrock';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function main() {
  console.log('Inserting transfer events for EthsRock directly...\n');

  // Get all ethsrock items
  const { data: items, error } = await supabase
    .from('ethscriptions')
    .select('hashId, tokenId')
    .eq('slug', SLUG);

  if (error) { console.error('DB error:', error); return; }
  console.log(`Found ${items.length} items\n`);

  // Get existing event txIds to avoid duplicates
  const hashIds = items.map(i => i.hashId);
  const { data: existingEvents } = await supabase
    .from('events')
    .select('txId')
    .in('hashId', hashIds);

  const existingTxIds = new Set((existingEvents || []).map(e => e.txId));
  console.log(`Existing events: ${existingTxIds.size}\n`);

  // Collect all transfers from API
  const allTransferEvents = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const res = await axios.get('https://api.ethscriptions.com/v2/ethscription_transfers', {
        params: { ethscription_transaction_hash: item.hashId }
      });

      const transfers = res.data.result || [];
      for (const t of transfers) {
        // Skip creation transfer (same hash as ethscription = already have 'created' event)
        if (t.transaction_hash.toLowerCase() === item.hashId.toLowerCase()) continue;

        const txId = `${t.transaction_hash.toLowerCase()}-${t.transaction_index}-${t.transfer_index || 0}`;

        // Skip if already exists
        if (existingTxIds.has(txId)) continue;

        allTransferEvents.push({
          txId,
          type: 'transfer',
          hashId: item.hashId.toLowerCase(),
          from: t.from_address.toLowerCase(),
          to: t.to_address.toLowerCase(),
          blockHash: t.block_blockhash?.toLowerCase() || null,
          txIndex: parseInt(t.transaction_index) || 0,
          txHash: t.transaction_hash.toLowerCase(),
          blockNumber: parseInt(t.block_number) || null,
          blockTimestamp: t.block_timestamp ? new Date(parseInt(t.block_timestamp) * 1000).toISOString() : null,
          value: '0',
        });
      }

      if ((i + 1) % 20 === 0) {
        console.log(`  Progress: ${i + 1}/${items.length} (${allTransferEvents.length} new transfer events)`);
      }

      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`  Error for tokenId ${item.tokenId}: ${err.message}`);
    }
  }

  console.log(`\nCollected ${allTransferEvents.length} new transfer events to insert\n`);

  if (allTransferEvents.length === 0) {
    console.log('No new events to insert!');
    return;
  }

  // Insert in batches
  let inserted = 0;
  for (let i = 0; i < allTransferEvents.length; i += 50) {
    const batch = allTransferEvents.slice(i, i + 50);
    const { error: insertError } = await supabase
      .from('events')
      .upsert(batch, { ignoreDuplicates: true });

    if (insertError) {
      console.error(`  Batch ${i} error:`, insertError.message);
    } else {
      inserted += batch.length;
      console.log(`  Inserted ${inserted}/${allTransferEvents.length}`);
    }
  }

  // Final count
  const { data: finalEvents } = await supabase
    .from('events')
    .select('type')
    .in('hashId', hashIds);

  const typeCounts = {};
  finalEvents.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });
  console.log('\nFinal events by type:', typeCounts);
  console.log('Total events:', finalEvents.length);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
