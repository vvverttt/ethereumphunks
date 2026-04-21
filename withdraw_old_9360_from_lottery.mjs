// Withdraw old #9360 hashId from the standard lottery pool
// Must be run by the lottery owner (0xea04f65...)
// This script just shows the ABI call needed — use the admin panel or hardhat

const OLD_9360_HASH = '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0';
const STD_LOTTERY = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';

// To withdraw via the admin panel on your site:
// 1. Go to the admin page
// 2. Use "Withdraw Prize" with hashId: 0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0

// Or via Hardhat:
// npx hardhat run this script

console.log('=== Withdraw old #9360 from standard lottery ===');
console.log('Contract:', STD_LOTTERY);
console.log('hashId to withdraw:', OLD_9360_HASH);
console.log('');
console.log('Call: withdrawPrize(bytes32 hashId) on the contract');
console.log('Only callable by owner:', '0xea04f65f9dc5917302532859d80fcf36a15de266');
console.log('');
console.log('After withdrawal, the new #9360 hashId can be deposited:');
console.log('New hashId:', '0x85f349d41feaf21d6efe953bf52147598a18a219364f169a4abd730bf6ae4092');

// Verify it's still in pool
import { keccak256, toHex } from 'viem';
const RPC = 'https://rpc.mevblocker.io';
async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return (await res.json()).result;
}

const inPoolSel = keccak256(toHex('inPool(bytes32)')).slice(0, 10);
const oldInPool = await rpc('eth_call', [{ to: STD_LOTTERY, data: inPoolSel + OLD_9360_HASH.slice(2) }, 'latest']);
const newHash = '0x85f349d41feaf21d6efe953bf52147598a18a219364f169a4abd730bf6ae4092';
const newInPool = await rpc('eth_call', [{ to: STD_LOTTERY, data: inPoolSel + newHash.slice(2) }, 'latest']);

console.log('');
console.log('Current state:');
console.log(`  Old #9360 inPool: ${oldInPool === '0x0000000000000000000000000000000000000000000000000000000000000001' ? 'YES (needs withdrawal)' : 'NO'}`);
console.log(`  New #9360 inPool: ${newInPool === '0x0000000000000000000000000000000000000000000000000000000000000001' ? 'YES' : 'NO (can be deposited)'}`);
