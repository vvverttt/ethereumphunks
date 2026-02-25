/**
 * Fetch market contract events for OG collections from on-chain logs
 * Uses eth_getLogs to get PhunkBought, PhunkOffered, PhunkDeposited, etc.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const RPC_URL = 'https://ethereum-rpc.publicnode.com';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const MARKET_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../indexer/src/abi/EtherPhunksMarketL1.json'), 'utf-8'));

// Old market contract (where OG items were traded)
const OLD_MARKET = '0xd3418772623be1a3cc6b6d45cb46420cedd9154a';
// New market contract
const NEW_MARKET = '0xa48a43186612b179c0bc68ea34b4932549a70bfa';

// Event signatures (topic0) - computed from keccak256 of event signature
// We'll compute these from the ABI
const { keccak256, toHex, decodeEventLog, numberToHex } = require('viem');

function getEventSignatures() {
  const events = MARKET_ABI.filter(x => x.type === 'event');
  const sigs = {};
  for (const evt of events) {
    const types = evt.inputs.map(i => i.type).join(',');
    const sig = `${evt.name}(${types})`;
    sigs[evt.name] = keccak256(toHex(sig));
  }
  return sigs;
}

async function rpcCall(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`RPC error: ${data.error.message}`);
  return data.result;
}

async function getBlock(blockNum) {
  const block = await rpcCall('eth_getBlockByNumber', [numberToHex(blockNum), false]);
  return block;
}

async function fetchMarketEvents(contractAddress, fromBlock, toBlock) {
  console.log(`  Fetching logs from ${contractAddress} blocks ${fromBlock}-${toBlock}...`);
  const logs = await rpcCall('eth_getLogs', [{
    address: contractAddress,
    fromBlock: numberToHex(fromBlock),
    toBlock: numberToHex(toBlock),
  }]);
  return logs || [];
}

async function main() {
  // 1. Get all OG hashIds
  const { data: ogItems } = await sb
    .from('ethscriptions')
    .select('hashId,slug')
    .or('slug.eq.og-missing-phunks,slug.eq.og-dysto-phunks');

  const ogHashIds = new Set(ogItems.map(i => i.hashId.toLowerCase()));
  console.log(`Found ${ogHashIds.size} OG items`);

  // 2. Get block ranges from existing events
  const { data: events } = await sb
    .from('events')
    .select('blockNumber')
    .or(`hashId.in.(${ogItems.map(i => i.hashId).join(',')})`)
    .order('blockNumber', { ascending: true })
    .limit(1);

  const { data: eventsDesc } = await sb
    .from('events')
    .select('blockNumber')
    .or(`hashId.in.(${ogItems.map(i => i.hashId).join(',')})`)
    .order('blockNumber', { ascending: false })
    .limit(1);

  const minBlock = events?.[0]?.blockNumber || 19089000;
  const maxBlock = eventsDesc?.[0]?.blockNumber || 24500000;
  console.log(`Block range: ${minBlock} - ${maxBlock}`);

  // 3. Fetch logs from both market contracts in chunks
  const allLogs = [];
  const chunkSize = 50000;

  for (const contractAddr of [OLD_MARKET, NEW_MARKET]) {
    for (let from = minBlock; from <= maxBlock; from += chunkSize) {
      const to = Math.min(from + chunkSize - 1, maxBlock);
      try {
        const logs = await fetchMarketEvents(contractAddr, from, to);
        // Filter logs that relate to OG items
        for (const log of logs) {
          // Check if any topic matches an OG hashId
          const matchesOg = log.topics.some(t => ogHashIds.has(t.toLowerCase()));
          if (matchesOg) {
            allLogs.push({ ...log, contractAddr });
          }
        }
        process.stdout.write(`\r  ${contractAddr.slice(0, 10)}... blocks ${from}-${to}: ${allLogs.length} matching logs`);
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`\n  Error fetching ${from}-${to}: ${err.message}`);
        // Try smaller chunks
        const smallChunk = 10000;
        for (let sf = from; sf <= to; sf += smallChunk) {
          const st = Math.min(sf + smallChunk - 1, to);
          try {
            const logs = await fetchMarketEvents(contractAddr, sf, st);
            for (const log of logs) {
              const matchesOg = log.topics.some(t => ogHashIds.has(t.toLowerCase()));
              if (matchesOg) allLogs.push({ ...log, contractAddr });
            }
            await new Promise(r => setTimeout(r, 200));
          } catch (e2) {
            console.error(`\n  Still failing ${sf}-${st}: ${e2.message}`);
          }
        }
      }
    }
    console.log('');
  }

  console.log(`\nTotal matching market logs: ${allLogs.length}`);

  if (allLogs.length === 0) {
    console.log('No market events found for OG items');
    return;
  }

  // 4. Decode logs and create events
  const newEvents = [];
  const blockCache = {};

  for (const log of allLogs) {
    try {
      const decoded = decodeEventLog({
        abi: MARKET_ABI,
        data: log.data,
        topics: log.topics,
      });

      // Get block timestamp
      const blockNum = parseInt(log.blockNumber, 16);
      if (!blockCache[blockNum]) {
        const block = await getBlock(blockNum);
        blockCache[blockNum] = new Date(parseInt(block.timestamp, 16) * 1000).toISOString();
        await new Promise(r => setTimeout(r, 100));
      }
      const blockTimestamp = blockCache[blockNum];

      const txHash = log.transactionHash.toLowerCase();
      const logIndex = parseInt(log.logIndex, 16);
      const hashId = findHashIdInEvent(decoded, log.topics);

      if (!hashId || !ogHashIds.has(hashId.toLowerCase())) continue;

      let eventType = null;
      let from = null;
      let to = null;
      let value = '0';

      switch (decoded.eventName) {
        case 'PotentialEthscriptionDeposited':
          eventType = 'PhunkDeposited';
          from = decoded.args.owner?.toLowerCase();
          to = log.address.toLowerCase();
          break;
        case 'PotentialEthscriptionWithdrawn':
          eventType = 'PhunkWithdrawn';
          from = log.address.toLowerCase();
          to = decoded.args.owner?.toLowerCase();
          break;
        case 'PhunkOffered':
          eventType = 'PhunkOffered';
          from = decoded.args.toAddress?.toLowerCase() || '0x0000000000000000000000000000000000000000';
          to = '0x0000000000000000000000000000000000000000';
          value = decoded.args.minValue?.toString() || '0';
          break;
        case 'PhunkBought':
          eventType = 'PhunkBought';
          from = decoded.args.fromAddress?.toLowerCase();
          to = decoded.args.toAddress?.toLowerCase();
          value = decoded.args.value?.toString() || '0';
          break;
        case 'PhunkNoLongerForSale':
          eventType = 'PhunkNoLongerForSale';
          break;
        case 'PhunkBidEntered':
          eventType = 'PhunkBidEntered';
          from = decoded.args.fromAddress?.toLowerCase();
          value = decoded.args.value?.toString() || '0';
          break;
        case 'PhunkBidWithdrawn':
          eventType = 'PhunkBidWithdrawn';
          from = decoded.args.fromAddress?.toLowerCase();
          value = decoded.args.value?.toString() || '0';
          break;
        default:
          continue;
      }

      if (eventType) {
        newEvents.push({
          txId: txHash + logIndex,
          hashId: hashId.toLowerCase(),
          from: from || '0x0000000000000000000000000000000000000000',
          to: to || '0x0000000000000000000000000000000000000000',
          blockHash: log.blockHash.toLowerCase(),
          txHash,
          blockNumber: blockNum,
          blockTimestamp,
          type: eventType,
          value,
          txIndex: parseInt(log.transactionIndex, 16),
        });
      }
    } catch (err) {
      // Skip logs we can't decode (not market events)
    }
  }

  console.log(`\nDecoded ${newEvents.length} market events`);
  if (newEvents.length > 0) {
    console.log('Event types:', [...new Set(newEvents.map(e => e.type))].join(', '));
  }

  // 5. Insert events
  let inserted = 0;
  for (let i = 0; i < newEvents.length; i += 50) {
    const batch = newEvents.slice(i, i + 50);
    const { error } = await sb.from('events').upsert(batch, { onConflict: 'txId' });
    if (error) {
      console.error(`  Batch ${i} error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`Inserted ${inserted} market events`);
}

function findHashIdInEvent(decoded, topics) {
  // The hashId/phunkId is usually an indexed bytes32 parameter
  const args = decoded.args;
  if (args.phunkId) return args.phunkId;
  if (args.potentialEthscriptionId) return args.potentialEthscriptionId;
  if (args.id) return args.id;
  // Check topics directly (indexed params)
  for (const topic of topics.slice(1)) {
    if (topic && topic.length === 66) return topic;
  }
  return null;
}

main().catch(console.error);
