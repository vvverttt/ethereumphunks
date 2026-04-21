import { createPublicClient, http, formatEther, parseAbiItem } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com'),
});

const STANDARD = '0x29b0d38112e8e743b63EB463F3351ab0F1E15977'.toLowerCase();
const ONE_OF_ONE = '0x298771ECc338DE242ADa11e49E2B8224c33bf620'.toLowerCase();

// commitPlay selector
const COMMIT_SELECTOR = '0x1c3db01b'; // Check this
// revealPlay selector
const REVEAL_SELECTOR = '0xc0c977f3';

// PlayCommitted event
const PLAY_COMMITTED_TOPIC = '0x' + 'PlayCommitted'; // We'll scan by selector instead

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  // Get all transactions to both lottery contracts from the player
  const player = '0xea04f65f9dc5917302532859d80fcf36a15de266';

  // Check contract balances
  for (const addr of [STANDARD, ONE_OF_ONE]) {
    const balance = await client.getBalance({ address: addr });
    console.log(`${addr.slice(0,10)}... balance: ${formatEther(balance)} ETH`);
  }

  // Check play prices
  for (const addr of [STANDARD, ONE_OF_ONE]) {
    try {
      const price = await client.readContract({
        address: addr,
        abi: [{ inputs: [], name: 'playPrice', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
        functionName: 'playPrice',
      });
      console.log(`${addr.slice(0,10)}... playPrice: ${formatEther(price)} ETH`);
    } catch (e) {
      console.log(`${addr.slice(0,10)}... playPrice error: ${e.message?.slice(0,60)}`);
    }
  }

  // Check playId counters
  for (const addr of [STANDARD, ONE_OF_ONE]) {
    try {
      const playId = await client.readContract({
        address: addr,
        abi: [{ inputs: [], name: 'playIdCounter', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
        functionName: 'playIdCounter',
      });
      console.log(`${addr.slice(0,10)}... playIdCounter: ${playId}`);
    } catch (e) {
      // Try nextPlayId
      try {
        const playId = await client.readContract({
          address: addr,
          abi: [{ inputs: [], name: 'nextPlayId', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }],
          functionName: 'nextPlayId',
        });
        console.log(`${addr.slice(0,10)}... nextPlayId: ${playId}`);
      } catch (e2) {
        console.log(`${addr.slice(0,10)}... playId counter error`);
      }
    }
  }

  console.log('\n--- Scanning recent txs to lottery contracts ---\n');

  // Get recent blocks' txs to the lottery contracts
  const currentBlock = await client.getBlockNumber();
  // Scan last ~500 blocks (~1.5 hours)
  const startBlock = currentBlock - 500n;

  // Use eth_getLogs to find PlayCommitted events
  // PlayCommitted(uint256 indexed playId, address indexed player, uint256 price)
  // Let's find the topic
  const { keccak256, toHex } = await import('viem');
  const playCommittedTopic = keccak256(toHex('PlayCommitted(uint256,address,uint256)'));
  const prizeAwardedTopic = keccak256(toHex('PrizeAwarded(uint256,address,bytes32)'));

  console.log('PlayCommitted topic:', playCommittedTopic);
  console.log('PrizeAwarded topic:', prizeAwardedTopic);

  for (const contractAddr of [STANDARD, ONE_OF_ONE]) {
    console.log(`\n=== ${contractAddr.slice(0,10)}... ===`);

    // Get PlayCommitted events
    const commitLogs = await client.request({
      method: 'eth_getLogs',
      params: [{
        address: contractAddr,
        topics: [playCommittedTopic],
        fromBlock: `0x${startBlock.toString(16)}`,
        toBlock: `0x${currentBlock.toString(16)}`,
      }]
    });

    console.log(`\nPlayCommitted events: ${commitLogs.length}`);
    for (const log of commitLogs) {
      const playId = Number(BigInt(log.topics[1]));
      const player = '0x' + log.topics[2].slice(26);
      // price is in data (not indexed)
      const price = BigInt(log.data);
      const block = Number(BigInt(log.blockNumber));
      const tx = log.transactionHash;

      // Get the actual tx to check ETH value
      const txData = await client.getTransaction({ hash: tx });
      console.log(`  Commit #${playId}: player=${player.slice(0,10)}... price=${formatEther(price)} ETH, txValue=${formatEther(txData.value)} ETH, block=${block}`);
      await sleep(100);
    }

    // Get PrizeAwarded events
    const prizeLogs = await client.request({
      method: 'eth_getLogs',
      params: [{
        address: contractAddr,
        topics: [prizeAwardedTopic],
        fromBlock: `0x${startBlock.toString(16)}`,
        toBlock: `0x${currentBlock.toString(16)}`,
      }]
    });

    console.log(`\nPrizeAwarded events: ${prizeLogs.length}`);
    for (const log of prizeLogs) {
      const playId = Number(BigInt(log.topics[1]));
      const winner = '0x' + log.topics[2].slice(26);
      const hashId = log.topics[3];
      const block = Number(BigInt(log.blockNumber));
      console.log(`  Prize #${playId}: winner=${winner.slice(0,10)}... hashId=${hashId.slice(0,18)}... block=${block}`);
    }
  }
}

main().catch(console.error);
