/**
 * reindex-v67-activity.js
 *
 * For 3399 updated V67 QuantumPhunks:
 *  1. Deletes stale 'created' events (pointing to old txHash)
 *  2. Fetches new transaction data from RPC
 *  3. Inserts correct 'created' events for the new transactions
 *
 * Run from indexer/:
 *   node reindex-v67-activity.js
 */

const { createClient } = require('@supabase/supabase-js');
const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '';
const UPDATES_JSON = 'C:\\Users\\alber\\OneDrive\\Desktop\\market\\v67 updates.json';
const RPC_URL = process.env.RPC_URL || 'https://eth.llamarpc.com';
const CONCURRENCY = 5;
const DRY_RUN = process.env.DRY_RUN === '1';
const START_INDEX = parseInt(process.env.START_INDEX || '0', 10);

async function runWithConcurrency(items, concurrency, fn) {
  let i = 0;
  async function worker() { while (i < items.length) { const idx = i++; await fn(items[idx], idx); } }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const rpc = createPublicClient({ chain: mainnet, transport: http(RPC_URL) });

  const updates = require(UPDATES_JSON);
  const todo = updates.slice(START_INDEX);
  console.log(`Processing ${todo.length} updates (start=${START_INDEX})\n`);
  if (DRY_RUN) console.log('⚠️  DRY RUN\n');

  // ── Step 1: Delete stale 'created' events ──────────────────────────────────
  console.log('🗑️  Step 1: Deleting stale created events...');
  let deleted = 0, noEvent = 0, delFailed = 0;

  await runWithConcurrency(todo, CONCURRENCY, async (u) => {
    const newHashId = u.transactionHash.toLowerCase();
    if (DRY_RUN) { deleted++; return; }

    // Delete any 'created' event for this hashId where txHash != newHashId (stale re-pointed ones)
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('hashId', newHashId)
      .eq('type', 'created')
      .neq('txHash', newHashId);

    if (error) { console.error('❌ delete', newHashId.slice(0,10), error.message); delFailed++; }
    else { deleted++; if (deleted % 200 === 0) console.log(`   ✅ ${deleted}/${todo.length}`); }
  });
  console.log(`   Done: ${deleted} processed, ${delFailed} errors\n`);

  // ── Step 2: Fetch tx data + insert new 'created' events ───────────────────
  console.log('📡 Step 2: Fetching tx data from RPC + inserting created events...');
  let inserted = 0, alreadyHas = 0, rpcFailed = 0, insFailed = 0;

  // Cache block timestamps to avoid re-fetching same block
  const blockCache = new Map();
  async function getBlock(blockNumber) {
    if (blockCache.has(blockNumber)) return blockCache.get(blockNumber);
    const block = await rpc.getBlock({ blockNumber });
    blockCache.set(blockNumber, block);
    return block;
  }

  await runWithConcurrency(todo, CONCURRENCY, async (u, relIdx) => {
    const absIdx = START_INDEX + relIdx;
    const newHashId = u.transactionHash.toLowerCase();

    // Check if a correct 'created' event already exists
    if (!DRY_RUN) {
      const { data: existing } = await supabase
        .from('events')
        .select('txId')
        .eq('hashId', newHashId)
        .eq('type', 'created')
        .eq('txHash', newHashId);
      if (existing?.length) { alreadyHas++; return; }
    }

    if (DRY_RUN) { inserted++; if (inserted % 500 === 0) console.log(`   DRY: ${inserted}/${todo.length}`); return; }

    // Fetch transaction from chain
    let tx, block;
    try {
      tx = await rpc.getTransaction({ hash: newHashId });
      block = await getBlock(tx.blockNumber);
    } catch (err) {
      // Retry once after delay
      try {
        await sleep(2000);
        tx = await rpc.getTransaction({ hash: newHashId });
        block = await getBlock(tx.blockNumber);
      } catch (err2) {
        console.error(`   ❌ RPC tokenId=${u.number}: ${err2.message}`);
        rpcFailed++;
        return;
      }
    }

    const newEvent = {
      txId: `${newHashId}-0-0`,
      type: 'created',
      hashId: newHashId,
      from: tx.from.toLowerCase(),
      to: (tx.to || tx.from).toLowerCase(),
      blockHash: tx.blockHash.toLowerCase(),
      txHash: newHashId,
      blockNumber: Number(tx.blockNumber),
      blockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
      txIndex: tx.transactionIndex,
      value: '0',
    };

    const { error } = await supabase.from('events').upsert(newEvent, { onConflict: 'txId' });
    if (error) {
      console.error(`   ❌ insert tokenId=${u.number}: ${error.message}`);
      insFailed++;
    } else {
      inserted++;
      if (inserted % 100 === 0) console.log(`   ✅ ${inserted}/${todo.length}`);
    }
  });

  console.log(`\n   Done: ${inserted} inserted, ${alreadyHas} already correct, ${rpcFailed} RPC errors, ${insFailed} insert errors`);
  if (rpcFailed > 0) console.log(`   ⚠️  Re-run with START_INDEX=N to retry failed items`);
  console.log('\n🎉 Done!');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
