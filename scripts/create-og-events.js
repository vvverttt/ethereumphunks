/**
 * Create events for OG collections in the events table
 * Generates "created" events + "transfer" events for items that changed hands
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';
const ETHSCRIPTIONS_API = 'https://api.ethscriptions.com/v2';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function fetchTxDetails(hashId, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${ETHSCRIPTIONS_API}/ethscriptions/${hashId}`);
      if (res.status === 429) {
        console.log(`  Rate limited, waiting 2s...`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!res.ok) return null;
      const data = await res.json();
      return data.result;
    } catch (err) {
      if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

async function createEventsForCollection(slug) {
  console.log(`\n=== Creating events for ${slug} ===`);

  const { data: items, error } = await sb
    .from('ethscriptions')
    .select('hashId,tokenId,creator,owner,prevOwner,createdAt')
    .eq('slug', slug)
    .order('tokenId', { ascending: true });

  if (error) {
    console.error('Failed to fetch items:', error);
    return;
  }

  console.log(`Found ${items.length} items`);
  const events = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    process.stdout.write(`\r  Fetching tx details ${i + 1}/${items.length} (#${item.tokenId})...`);

    const tx = await fetchTxDetails(item.hashId);
    if (!tx) {
      console.log(`\n  Failed to fetch tx for #${item.tokenId}`);
      continue;
    }

    const blockTimestamp = new Date(Number(tx.block_timestamp) * 1000).toISOString();

    // "created" event
    events.push({
      txId: `${item.hashId}-created`,
      hashId: item.hashId,
      from: '0x0000000000000000000000000000000000000000',
      to: tx.initial_owner?.toLowerCase() || tx.creator?.toLowerCase(),
      blockHash: tx.block_blockhash,
      txHash: item.hashId,
      blockNumber: Number(tx.block_number),
      blockTimestamp,
      type: 'created',
      value: '0',
      txIndex: Number(tx.transaction_index) || 0,
    });

    // If current owner differs from creator, add a "transfer" event
    const currentOwner = tx.current_owner?.toLowerCase();
    const creator = tx.creator?.toLowerCase();
    if (currentOwner && creator && currentOwner !== creator) {
      // Get transfer history if available
      const prevOwner = tx.previous_owner?.toLowerCase() || creator;
      events.push({
        txId: `${item.hashId}-transfer`,
        hashId: item.hashId,
        from: prevOwner,
        to: currentOwner,
        blockHash: tx.block_blockhash,
        txHash: item.hashId,
        blockNumber: Number(tx.block_number) + 1, // slightly after creation
        blockTimestamp: new Date(Number(tx.block_timestamp) * 1000 + 1000).toISOString(),
        type: 'transfer',
        value: '0',
        txIndex: 0,
      });
    }

    // Rate limit
    if ((i + 1) % 10 === 0) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\n  Generated ${events.length} events`);

  // Insert in batches
  let inserted = 0;
  for (let i = 0; i < events.length; i += 50) {
    const batch = events.slice(i, i + 50);
    const { error } = await sb.from('events').upsert(batch, {
      onConflict: 'txId',
      ignoreDuplicates: true,
    });
    if (error) {
      console.error(`  Batch ${i} error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  Inserted ${inserted} events`);
}

async function main() {
  await createEventsForCollection('og-missing-phunks');
  await createEventsForCollection('og-dysto-phunks');
  console.log('\nDone!');
}

main().catch(console.error);
