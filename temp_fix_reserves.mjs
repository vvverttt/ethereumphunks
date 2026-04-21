import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, 'contracts/.env') });

const AUCTION_ADDRESS = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';
const TARGET_RESERVE = parseEther('0.67');

const ABI = [
  { name: 'poolSize', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'getPoolItems', type: 'function', stateMutability: 'view', inputs: [{ name: 'offset', type: 'uint256' }, { name: 'limit', type: 'uint256' }], outputs: [{ type: 'bytes32[]' }] },
  { name: 'auction', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: 'hashId', type: 'bytes32' }, { name: 'amount', type: 'uint256' }, { name: 'startTime', type: 'uint256' }, { name: 'endTime', type: 'uint256' }, { name: 'bidder', type: 'address' }, { name: 'settled', type: 'bool' }, { name: 'auctionId', type: 'uint256' }] },
  { name: 'itemReservePrice', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
  { name: 'setItemReservePrices', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'hashIds', type: 'bytes32[]' }, { name: 'prices', type: 'uint256[]' }], outputs: [] },
];

const client = createPublicClient({ chain: mainnet, transport: http('https://rpc.mevblocker.io') });

// Get active auction item
const activeAuction = await client.readContract({ address: AUCTION_ADDRESS, abi: ABI, functionName: 'auction' });
const poolSize = await client.readContract({ address: AUCTION_ADDRESS, abi: ABI, functionName: 'poolSize' });
const poolItems = await client.readContract({ address: AUCTION_ADDRESS, abi: ABI, functionName: 'getPoolItems', args: [0n, poolSize] });

const allItems = [];
// Add active auction if not settled
if (activeAuction.startTime > 0n && !activeAuction.settled) {
  allItems.push({ hashId: activeAuction.hashId, source: 'active' });
}
for (const h of poolItems) allItems.push({ hashId: h, source: 'pool' });

console.log(`Total items to check: ${allItems.length} (1 active + ${poolItems.length} pool)\n`);

const needsUpdate = [];
for (const { hashId, source } of allItems) {
  const res = await client.readContract({ address: AUCTION_ADDRESS, abi: ABI, functionName: 'itemReservePrice', args: [hashId] });
  const ok = res === TARGET_RESERVE;
  console.log(`[${source}] ${hashId.slice(0,20)}...: ${Number(res)/1e18} ETH ${ok ? '✅' : '❌ NEEDS UPDATE'}`);
  if (!ok) needsUpdate.push(hashId);
}

if (needsUpdate.length === 0) {
  console.log('\nAll items already at 0.67 ETH ✅');
  process.exit(0);
}

console.log(`\n${needsUpdate.length} items need reserve update. Setting now...`);

const pk = process.env.PRIVATE_KEY;
if (!pk) { console.error('No PRIVATE_KEY in .env'); process.exit(1); }
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
console.log(`Signer: ${account.address}`);

const wallet = createWalletClient({ account, chain: mainnet, transport: http('https://rpc.mevblocker.io') });
const prices = needsUpdate.map(() => TARGET_RESERVE);
const tx = await wallet.writeContract({
  address: AUCTION_ADDRESS,
  abi: ABI,
  functionName: 'setItemReservePrices',
  args: [needsUpdate, prices],
});
console.log(`TX sent: ${tx}`);
const receipt = await client.waitForTransactionReceipt({ hash: tx });
console.log(`Status: ${receipt.status} block=${receipt.blockNumber}`);
console.log(`Set ${needsUpdate.length} items to 0.67 ETH ✅`);
