const STD_LOTTERY = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';
const RPC = 'https://rpc.mevblocker.io';

async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return (await res.json()).result;
}

const inPoolSel = '0x' + Buffer.from('inPool(bytes32)').toString('hex'); // need keccak
// Use eth_call with selector
async function inPool(hashId) {
  // keccak256("inPool(bytes32)") = 0x4d8a2c4e ... let me compute manually
  // Actually let's use the 4-byte selector
  const data = '0x4d8a2c4e' + hashId.slice(2).padStart(64, '0');
  const result = await rpc('eth_call', [{ to: STD_LOTTERY, data }, 'latest']);
  return result === '0x0000000000000000000000000000000000000000000000000000000000000001';
}

// Old hashes before re-ethscription
const oldHashes = [
  { tokenId: 1569, hash: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d' },
  { tokenId: 2103, hash: '0x1ed45d8d35d5b5f95b3bf2e97a1c5563d665b4653ba295f0961fefb4b84e7ae3' },
  { tokenId: 3080, hash: '0xee0cfcae35f9f839d93b21fa815b310a660b458eb1029f5a4cdc6ccd0b5bd8eb' },
  { tokenId: 3719, hash: '0x76e22f2334637a18a94c48e4be78cd23e0c938ea37e9de7bab3848e1a8a3a03d' },
  { tokenId: 8663, hash: '0xaf3227fa491fbbf0eb4adc1b9078fcca3ea8f2f79916f98822c89d6f702861cd' },
  { tokenId: 8699, hash: '0x554205831931235cbee89cfc56facf1f32e9128674a522b9e2d4a6c7d9507919' },
  { tokenId: 9360, hash: '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0' },
  { tokenId: 9363, hash: '0xf8f8b15a6b2aebbd8cea5348c75a921ed19846aa1f31b3667b3993866ebdc573' },
];

console.log('=== Checking old hashes in standard lottery pool ===');
for (const item of oldHashes) {
  const result = await inPool(item.hash);
  console.log(`  #${item.tokenId}: ${result ? 'IN POOL ⚠️' : 'not in pool ✓'}`);
}
