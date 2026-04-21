import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbnByYmhvb2RtZ2ZocW9qbXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTM1NTYsImV4cCI6MjA4OTQ4OTU1Nn0.jum-NTWlLJnxmbxe9foylgrEMhGrhn34IPxd4aiyTSE';
const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET = '0xc33f8610941be56fb0d84e25894c0d928cc97dde';

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://1rpc.io/eth'),
});

// ESIP-1 event: ethscriptions_protocol_TransferEthscription(address indexed recipient, bytes32 indexed id)
const ESIP1_TOPIC = '0xf30861289185032f511ff94a8127e470f3d0e6230be4925cb6fad33f3436dffb';
// ESIP-2 event: ethscriptions_protocol_TransferEthscriptionForPreviousOwner(address indexed previousOwner, bytes32 indexed ethscriptionId)
const ESIP2_TOPIC = '0xf1d95ed4d1680e6f665104f19c296ae52c1f64cd8114e84d55dc6349dbdafea3';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  // 1. Get all OG Missing Phunks from DB
  const { data: items, error } = await supabase
    .from('ethscriptions')
    .select('hashId, sha, tokenId, slug, owner')
    .eq('slug', 'og-missing-phunks')
    .order('tokenId', { ascending: true });

  if (error) {
    console.error('DB error:', error.message);
    return;
  }

  console.log(`Found ${items.length} OG Missing Phunks in DB\n`);

  // Show which ones DB says are at the target
  const dbOwned = items.filter(i => i.owner?.toLowerCase() === TARGET);
  console.log(`DB says ${dbOwned.length} are owned by ${TARGET}:`);
  for (const i of dbOwned) {
    console.log(`  #${i.tokenId} (${i.hashId.slice(0, 18)}...)`);
  }

  console.log(`\n--- Now scanning on-chain for ALL ESIP-1 and ESIP-2 transfers TO ${TARGET} ---\n`);

  // Build a set of all OG Missing Phunks hashIds for quick lookup
  const hashIdToToken = new Map();
  for (const i of items) {
    hashIdToToken.set(i.hashId.toLowerCase(), i.tokenId);
  }

  // Scan for ESIP-1 transfers where recipient = TARGET
  // ESIP-1: topics[0]=sig, topics[1]=recipient(indexed), topics[2]=id(indexed)
  const recipientTopic = '0x' + TARGET.slice(2).padStart(64, '0');

  const currentBlock = await client.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);

  const startBlock = 17672762n; // ESIP-1 start
  const batchSize = 50000n;

  let foundTransfers = [];

  // Scan ESIP-1
  console.log('\nScanning ESIP-1 transfers to target...');
  for (let from = startBlock; from <= currentBlock; from += batchSize) {
    const to = from + batchSize - 1n > currentBlock ? currentBlock : from + batchSize - 1n;
    try {
      const logs = await client.request({
        method: 'eth_getLogs',
        params: [{
          topics: [ESIP1_TOPIC, recipientTopic],
          fromBlock: `0x${from.toString(16)}`,
          toBlock: `0x${to.toString(16)}`,
        }]
      });
      for (const log of logs) {
        const hashId = log.topics[2]?.toLowerCase();
        const tokenId = hashIdToToken.get(hashId);
        if (tokenId !== undefined) {
          foundTransfers.push({
            type: 'ESIP-1',
            tokenId,
            hashId,
            block: Number(BigInt(log.blockNumber)),
            tx: log.transactionHash,
            from: log.address,
          });
          console.log(`  FOUND ESIP-1: #${tokenId} at block ${Number(BigInt(log.blockNumber))}`);
        }
      }
    } catch (err) {
      // Try smaller batches
      const smallBatch = 5000n;
      for (let fb = from; fb <= to; fb += smallBatch) {
        const tb = fb + smallBatch - 1n > to ? to : fb + smallBatch - 1n;
        try {
          const logs = await client.request({
            method: 'eth_getLogs',
            params: [{
              topics: [ESIP1_TOPIC, recipientTopic],
              fromBlock: `0x${fb.toString(16)}`,
              toBlock: `0x${tb.toString(16)}`,
            }]
          });
          for (const log of logs) {
            const hashId = log.topics[2]?.toLowerCase();
            const tokenId = hashIdToToken.get(hashId);
            if (tokenId !== undefined) {
              foundTransfers.push({
                type: 'ESIP-1',
                tokenId,
                hashId,
                block: Number(BigInt(log.blockNumber)),
                tx: log.transactionHash,
                from: log.address,
              });
              console.log(`  FOUND ESIP-1: #${tokenId} at block ${Number(BigInt(log.blockNumber))}`);
            }
          }
        } catch (e2) {
          console.error(`  skip ${fb}-${tb}: ${e2.message?.slice(0, 50)}`);
        }
        await sleep(150);
      }
    }
    await sleep(100);
    if ((from - startBlock) % (batchSize * 10n) === 0n) {
      console.log(`  ... scanned to block ${to}`);
    }
  }

  // Scan ESIP-2 transfers where recipient is in topics
  // ESIP-2: topics[0]=sig, topics[1]=previousOwner(indexed), topics[2]=ethscriptionId(indexed)
  // Wait - ESIP-2 doesn't have recipient indexed! Let me check...
  // Actually the event is: TransferEthscriptionForPreviousOwner(address indexed previousOwner, bytes32 indexed ethscriptionId)
  // The SENDER of the tx is the one transferring, and previousOwner validates ownership
  // So the RECIPIENT is actually the tx.to or needs to be decoded differently

  // For ESIP-2, we need to look at logs emitted BY the target contract
  console.log('\nScanning ESIP-2 transfers emitted by target contract...');
  for (let from = 17764910n; from <= currentBlock; from += batchSize) {
    const to = from + batchSize - 1n > currentBlock ? currentBlock : from + batchSize - 1n;
    try {
      const logs = await client.request({
        method: 'eth_getLogs',
        params: [{
          address: TARGET,
          topics: [ESIP2_TOPIC],
          fromBlock: `0x${from.toString(16)}`,
          toBlock: `0x${to.toString(16)}`,
        }]
      });
      for (const log of logs) {
        const hashId = log.topics[2]?.toLowerCase();
        const tokenId = hashIdToToken.get(hashId);
        if (tokenId !== undefined) {
          const prevOwner = '0x' + log.topics[1].slice(26);
          foundTransfers.push({
            type: 'ESIP-2 (from target)',
            tokenId,
            hashId,
            block: Number(BigInt(log.blockNumber)),
            tx: log.transactionHash,
            prevOwner,
          });
          console.log(`  FOUND ESIP-2 FROM target: #${tokenId} prev=${prevOwner} at block ${Number(BigInt(log.blockNumber))}`);
        }
      }
    } catch (err) {
      const smallBatch = 5000n;
      for (let fb = from; fb <= to; fb += smallBatch) {
        const tb = fb + smallBatch - 1n > to ? to : fb + smallBatch - 1n;
        try {
          const logs = await client.request({
            method: 'eth_getLogs',
            params: [{
              address: TARGET,
              topics: [ESIP2_TOPIC],
              fromBlock: `0x${fb.toString(16)}`,
              toBlock: `0x${tb.toString(16)}`,
            }]
          });
          for (const log of logs) {
            const hashId = log.topics[2]?.toLowerCase();
            const tokenId = hashIdToToken.get(hashId);
            if (tokenId !== undefined) {
              foundTransfers.push({
                type: 'ESIP-2 (from target)',
                tokenId,
                hashId,
                block: Number(BigInt(log.blockNumber)),
                tx: log.transactionHash,
              });
              console.log(`  FOUND ESIP-2 FROM target: #${tokenId} at block ${Number(BigInt(log.blockNumber))}`);
            }
          }
        } catch (e2) {
          console.error(`  skip ${fb}-${tb}: ${e2.message?.slice(0, 50)}`);
        }
        await sleep(150);
      }
    }
    await sleep(100);
    if ((from - 17764910n) % (batchSize * 10n) === 0n) {
      console.log(`  ... scanned to block ${to}`);
    }
  }

  // Also check: did target contract receive any via ESIP-1 where it's the emitter?
  // ESIP-1 is emitted by the SENDER contract. So if someone sent TO target,
  // target would appear as recipient in topics[1], which we already scanned above.
  // But also check if target contract itself emitted ESIP-1 (meaning it sent items away)
  console.log('\nScanning ESIP-1 transfers emitted BY target contract (outgoing)...');
  for (let from = startBlock; from <= currentBlock; from += batchSize) {
    const to = from + batchSize - 1n > currentBlock ? currentBlock : from + batchSize - 1n;
    try {
      const logs = await client.request({
        method: 'eth_getLogs',
        params: [{
          address: TARGET,
          topics: [ESIP1_TOPIC],
          fromBlock: `0x${from.toString(16)}`,
          toBlock: `0x${to.toString(16)}`,
        }]
      });
      for (const log of logs) {
        const hashId = log.topics[2]?.toLowerCase();
        const tokenId = hashIdToToken.get(hashId);
        if (tokenId !== undefined) {
          const recipient = '0x' + log.topics[1].slice(26);
          foundTransfers.push({
            type: 'ESIP-1 (target sent OUT)',
            tokenId,
            hashId,
            block: Number(BigInt(log.blockNumber)),
            tx: log.transactionHash,
            recipient,
          });
          console.log(`  FOUND ESIP-1 OUT: #${tokenId} -> ${recipient} at block ${Number(BigInt(log.blockNumber))}`);
        }
      }
    } catch (err) {
      // smaller batches
      const smallBatch = 5000n;
      for (let fb = from; fb <= to; fb += smallBatch) {
        const tb = fb + smallBatch - 1n > to ? to : fb + smallBatch - 1n;
        try {
          const logs = await client.request({
            method: 'eth_getLogs',
            params: [{
              address: TARGET,
              topics: [ESIP1_TOPIC],
              fromBlock: `0x${fb.toString(16)}`,
              toBlock: `0x${tb.toString(16)}`,
            }]
          });
          for (const log of logs) {
            const hashId = log.topics[2]?.toLowerCase();
            const tokenId = hashIdToToken.get(hashId);
            if (tokenId !== undefined) {
              const recipient = '0x' + log.topics[1].slice(26);
              foundTransfers.push({
                type: 'ESIP-1 (target sent OUT)',
                tokenId,
                hashId,
                block: Number(BigInt(log.blockNumber)),
                tx: log.transactionHash,
                recipient,
              });
              console.log(`  FOUND ESIP-1 OUT: #${tokenId} -> ${recipient}`);
            }
          }
        } catch (e2) {}
        await sleep(150);
      }
    }
    await sleep(100);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`DB says ${dbOwned.length} OG Missing Phunks at ${TARGET}`);
  console.log(`On-chain found ${foundTransfers.length} transfer events involving target + OG Missing Phunks:\n`);
  for (const t of foundTransfers) {
    console.log(`  ${t.type}: #${t.tokenId} block=${t.block} tx=${t.tx?.slice(0,18)}...`);
  }

  // Also list ALL OG Missing Phunks and their current DB owners
  console.log(`\n--- All ${items.length} OG Missing Phunks DB owners ---`);
  for (const i of items) {
    const marker = i.owner?.toLowerCase() === TARGET ? ' <<<< TARGET' : '';
    console.log(`  #${i.tokenId}: ${i.owner?.slice(0, 12)}...${marker}`);
  }
}

main().catch(console.error);
