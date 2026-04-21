/**
 * Rebuild events for OG collections using full transfer history from ethscriptions API
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';
const ETHSCRIPTIONS_API = 'https://api.ethscriptions.com/v2';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function fetchFullHistory(hashId, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${ETHSCRIPTIONS_API}/ethscriptions/${hashId}`);
      if (res.status === 429) {
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

async function rebuildEvents(slug) {
  console.log(`\n=== Rebuilding events for ${slug} ===`);

  // 1. Delete existing OG events
  const { data: items, error: fetchErr } = await sb
    .from('ethscriptions')
    .select('hashId,tokenId')
    .eq('slug', slug)
    .order('tokenId', { ascending: true });

  if (fetchErr) {
    console.error('Failed to fetch items:', fetchErr);
    return;
  }

  // Delete old events for these hashIds
  const hashIds = items.map(i => i.hashId);
  for (let i = 0; i < hashIds.length; i += 50) {
    const batch = hashIds.slice(i, i + 50);
    await sb.from('events').delete().in('hashId', batch);
  }
  console.log(`  Deleted old events for ${hashIds.length} items`);

  // 2. Fetch full history and create proper events
  const allEvents = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    process.stdout.write(`\r  Processing ${i + 1}/${items.length} (#${item.tokenId})...`);

    const data = await fetchFullHistory(item.hashId);
    if (!data) {
      console.log(`\n  Failed to fetch ${item.hashId}`);
      continue;
    }

    const transfers = data.ethscription_transfers || [];

    for (let t = 0; t < transfers.length; t++) {
      const xfer = transfers[t];
      const blockTimestamp = new Date(Number(xfer.block_timestamp) * 1000).toISOString();
      const txHash = xfer.transaction_hash.toLowerCase();
      const txIndex = Number(xfer.transaction_index) || 0;

      if (t === 0) {
        // First transfer = creation event
        // Frontend shows event.to as "Created by", so to=creator, from=0x0
        allEvents.push({
          txId: txHash + '-' + item.hashId.slice(2, 10) + '-created',
          hashId: item.hashId,
          from: '0x0000000000000000000000000000000000000000',
          to: data.creator.toLowerCase(),
          blockHash: xfer.block_blockhash.toLowerCase(),
          txHash,
          blockNumber: Number(xfer.block_number),
          blockTimestamp,
          type: 'created',
          value: '0',
          txIndex,
        });
      } else {
        // Subsequent transfers
        allEvents.push({
          txId: txHash + '-' + item.hashId.slice(2, 10) + '-' + t,
          hashId: item.hashId,
          from: xfer.from_address.toLowerCase(),
          to: xfer.to_address.toLowerCase(),
          blockHash: xfer.block_blockhash.toLowerCase(),
          txHash,
          blockNumber: Number(xfer.block_number),
          blockTimestamp,
          type: 'transfer',
          value: '0',
          txIndex,
        });
      }
    }

    // Rate limit
    if ((i + 1) % 10 === 0) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\n  Generated ${allEvents.length} events`);

  // 3. Insert in batches
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < allEvents.length; i += 50) {
    const batch = allEvents.slice(i, i + 50);
    const { error } = await sb.from('events').insert(batch);
    if (error) {
      console.error(`  Batch ${i} error:`, error.message);
      errors++;
    } else {
      inserted += batch.length;
    }
  }

  console.log(`  Inserted ${inserted} events (${errors} batch errors)`);
}

async function main() {
  await rebuildEvents('og-missing-phunks');
  await rebuildEvents('og-dysto-phunks');
  console.log('\nDone!');
}

main().catch(console.error);
