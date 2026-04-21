import { createPublicClient, http, keccak256, toHex } from 'viem';
import { mainnet } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || 'YOUR_SERVICE_ROLE_KEY_HERE';
const supabase = createClient(supabaseUrl, supabaseKey);

const rpcUrl = 'https://1rpc.io/eth';
const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });

const LOTTERY_CONTRACTS = [
  '0x29b0d38112e8e743b63EB463F3351ab0F1E15977',
  '0x298771ECc338DE242ADa11e49E2B8224c33bf620',
];

const START_BLOCK = 20000000n;

// PrizeAwarded(uint256 indexed playId, address indexed winner, bytes32 indexed hashId)
// All 3 params are indexed, so hashId (bytes32) is stored as topic[3] directly (no keccak for fixed-size types)
const PRIZE_AWARDED_TOPIC = keccak256(toHex('PrizeAwarded(uint256,address,bytes32)'));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function backfill() {
  const currentBlock = await client.getBlockNumber();
  console.log(`Current block: ${currentBlock}`);

  for (const contractAddress of LOTTERY_CONTRACTS) {
    console.log(`\nScanning ${contractAddress}...`);

    let allLogs = [];
    const batchSize = 10000n;

    for (let fromBlock = START_BLOCK; fromBlock <= currentBlock; fromBlock += batchSize) {
      const toBlock = fromBlock + batchSize - 1n > currentBlock ? currentBlock : fromBlock + batchSize - 1n;

      let retries = 3;
      while (retries > 0) {
        try {
          const logs = await client.request({
            method: 'eth_getLogs',
            params: [{
              address: contractAddress,
              topics: [PRIZE_AWARDED_TOPIC],
              fromBlock: `0x${fromBlock.toString(16)}`,
              toBlock: `0x${toBlock.toString(16)}`,
            }]
          });
          if (logs.length) {
            allLogs.push(...logs);
            console.log(`  ${fromBlock}-${toBlock}: ${logs.length} events`);
          }
          break;
        } catch (err) {
          retries--;
          if (retries === 0) {
            const smallBatch = 2000n;
            for (let fb = fromBlock; fb <= toBlock; fb += smallBatch) {
              const tb = fb + smallBatch - 1n > toBlock ? toBlock : fb + smallBatch - 1n;
              try {
                const logs = await client.request({
                  method: 'eth_getLogs',
                  params: [{
                    address: contractAddress,
                    topics: [PRIZE_AWARDED_TOPIC],
                    fromBlock: `0x${fb.toString(16)}`,
                    toBlock: `0x${tb.toString(16)}`,
                  }]
                });
                if (logs.length) {
                  allLogs.push(...logs);
                  console.log(`    ${fb}-${tb}: ${logs.length} events`);
                }
              } catch (err2) {
                console.error(`    SKIP ${fb}-${tb}: ${err2.message?.slice(0, 60)}`);
              }
              await sleep(200);
            }
          } else {
            await sleep(500);
          }
        }
      }
      await sleep(100);
    }

    console.log(`\nFound ${allLogs.length} PrizeAwarded events for ${contractAddress}`);

    const blockCache = new Map();

    for (const log of allLogs) {
      // topics[0] = event sig, topics[1] = playId, topics[2] = winner, topics[3] = hashId
      const playId = Number(BigInt(log.topics[1]));
      const winner = ('0x' + log.topics[2].slice(26)).toLowerCase();
      const hashId = log.topics[3].toLowerCase(); // bytes32 indexed = raw value in topic
      const txHash = log.transactionHash.toLowerCase();
      const blockNumber = Number(BigInt(log.blockNumber));
      const logIndex = Number(BigInt(log.logIndex || '0x0'));

      // Get block timestamp
      let createdAt;
      if (blockCache.has(blockNumber)) {
        createdAt = blockCache.get(blockNumber);
      } else {
        try {
          const block = await client.getBlock({ blockNumber: BigInt(blockNumber) });
          createdAt = new Date(Number(block.timestamp) * 1000).toISOString();
          blockCache.set(blockNumber, createdAt);
        } catch {
          createdAt = new Date().toISOString();
        }
      }

      // Look up ethscription details
      const { data: eth } = await supabase
        .from('ethscriptions')
        .select('sha, tokenId, slug')
        .eq('hashId', hashId)
        .single();

      // 1. Insert lottery_wins (delete first to avoid duplicates)
      await supabase
        .from('lottery_wins')
        .delete()
        .eq('contract_address', contractAddress.toLowerCase())
        .eq('play_id', playId);

      const { error } = await supabase
        .from('lottery_wins')
        .insert({
          contract_address: contractAddress.toLowerCase(),
          play_id: playId,
          winner,
          hash_id: hashId,
          sha: eth?.sha || '',
          token_id: eth?.tokenId || 0,
          collection_slug: eth?.slug || '',
          transfer_status: 'transferred',
          tx_hash: txHash,
          created_at: createdAt,
        });

      if (error) {
        console.error(`  FAIL play #${playId}: ${error.message}`);
      } else {
        console.log(`  ✓ play #${playId} -> ${winner.slice(0,10)}... won #${eth?.tokenId ?? '?'} (block ${blockNumber})`);
      }

      // 2. Insert PrizeAwarded event
      await supabase
        .from('events')
        .upsert({
          txId: `${txHash}-${logIndex}`,
          blockTimestamp: createdAt,
          type: 'PrizeAwarded',
          value: '0',
          hashId,
          from: contractAddress.toLowerCase(),
          to: winner,
          blockNumber,
          blockHash: (log.blockHash || '').toLowerCase(),
          txIndex: Number(BigInt(log.transactionIndex || '0x0')),
          txHash,
        });
    }
  }

  console.log('\nDone!');
}

backfill().catch(console.error);
