import { createPublicClient, http, formatEther } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({ chain: mainnet, transport: http('https://eth.llamarpc.com') });
const address = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';

// Minimal ABI to check state
const abi = [
  { inputs: [], name: 'paused', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'poolSize', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalRevealed', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'pendingReveals', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'currentPrice', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'BASE_PRICE', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'owner', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'priceFeed', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'usdPerSale', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalCommittedETH', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
];

async function main() {
  const results = {};
  for (const fn of abi) {
    try {
      const val = await client.readContract({ address, abi, functionName: fn.name });
      results[fn.name] = val;
    } catch (e) {
      results[fn.name] = `ERROR: ${e.message?.slice(0, 80)}`;
    }
  }

  console.log('=== Contract State ===\n');
  console.log('paused:', results.paused);
  console.log('poolSize:', Number(results.poolSize));
  console.log('totalRevealed:', Number(results.totalRevealed));
  console.log('pendingReveals:', Number(results.pendingReveals));
  console.log('currentPrice:', typeof results.currentPrice === 'bigint' ? formatEther(results.currentPrice) + ' ETH' : results.currentPrice);
  console.log('BASE_PRICE:', typeof results.BASE_PRICE === 'bigint' ? formatEther(results.BASE_PRICE) + ' ETH' : results.BASE_PRICE);
  console.log('owner:', results.owner);
  console.log('priceFeed:', results.priceFeed);
  console.log('usdPerSale:', results.usdPerSale);
  console.log('totalCommittedETH:', typeof results.totalCommittedETH === 'bigint' ? formatEther(results.totalCommittedETH) + ' ETH' : results.totalCommittedETH);

  if (typeof results.poolSize === 'bigint' && typeof results.pendingReveals === 'bigint') {
    const available = Number(results.poolSize) - Number(results.pendingReveals);
    console.log('available (pool - pending):', available);
  }
}

main().catch(console.error);
