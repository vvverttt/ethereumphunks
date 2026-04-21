import { createWalletClient, createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x8a394b3f9e8840546567cecdba7338974e49e497c9d7eec16a550b8a10daf8b4');
const auctionAddress = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';

const walletClient = createWalletClient({ account, chain: mainnet, transport: http('https://ethereum-rpc.publicnode.com') });
const publicClient = createPublicClient({ chain: mainnet, transport: http('https://ethereum-rpc.publicnode.com') });

const ABI = [
  {
    inputs: [{ internalType: 'uint256', name: '_duration', type: 'uint256' }],
    name: 'setDuration',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'settleAndCreate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

async function main() {
  // Set duration to 30 minutes (1800 seconds)
  console.log('Setting duration to 30 minutes...');
  const tx1 = await walletClient.writeContract({
    address: auctionAddress,
    abi: ABI,
    functionName: 'setDuration',
    args: [1800],
  });
  console.log(`TX1 (setDuration): ${tx1}`);
  const r1 = await publicClient.waitForTransactionReceipt({ hash: tx1, timeout: 120_000 });
  console.log(`Status: ${r1.status}`);

  // Start first auction
  console.log('\nStarting first auction (settleAndCreate)...');
  const tx2 = await walletClient.writeContract({
    address: auctionAddress,
    abi: ABI,
    functionName: 'settleAndCreate',
  });
  console.log(`TX2 (settleAndCreate): ${tx2}`);
  const r2 = await publicClient.waitForTransactionReceipt({ hash: tx2, timeout: 120_000 });
  console.log(`Status: ${r2.status}`);
}

main().catch(console.error);
