import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, 'contracts/.env') });

const AUCTION_ADDRESS = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';
const HASH_ID = '0x956d03a761982b57547c97fa5e2f298beb581b01a557aa7f3aa6e5b9c9f5aeb2';
const TARGET_RESERVE = parseEther('0.67');

const ABI = [
  { name: 'itemReservePrice', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
  { name: 'setItemReservePrices', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'hashIds', type: 'bytes32[]' }, { name: 'prices', type: 'uint256[]' }], outputs: [] },
];

const client = createPublicClient({ chain: mainnet, transport: http('https://rpc.mevblocker.io') });
const currentReserve = await client.readContract({ address: AUCTION_ADDRESS, abi: ABI, functionName: 'itemReservePrice', args: [HASH_ID] });
console.log(`Token #5360 hashId=${HASH_ID.slice(0,18)}...`);
console.log(`Current itemReservePrice: ${currentReserve} wei (${Number(currentReserve) / 1e18} ETH)`);

if (currentReserve === TARGET_RESERVE) {
  console.log('Already set to 0.67 ETH ✅');
  process.exit(0);
}

// Need to set it
const pk = process.env.PRIVATE_KEY;
if (!pk) { console.error('No PRIVATE_KEY in .env'); process.exit(1); }
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
console.log(`Signer: ${account.address}`);

const wallet = createWalletClient({ account, chain: mainnet, transport: http('https://rpc.mevblocker.io') });
const tx = await wallet.writeContract({
  address: AUCTION_ADDRESS,
  abi: ABI,
  functionName: 'setItemReservePrices',
  args: [[HASH_ID], [TARGET_RESERVE]],
});
console.log(`TX sent: ${tx}`);
const receipt = await client.waitForTransactionReceipt({ hash: tx });
console.log(`Status: ${receipt.status} block=${receipt.blockNumber}`);
console.log('Reserve set to 0.67 ETH ✅');
