import { readFileSync } from 'fs';

const PROXY = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';
const RPC = 'https://rpc.mevblocker.io';

const abi = JSON.parse(readFileSync('./contracts/artifacts/contracts/V2MainnetUpgrade/PhilipLotteryV67.sol/PhilipLotteryV67.json', 'utf8')).abi;

async function call(method, params = []) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return (await res.json()).result;
}

// Encode eth_call for inPool(bytes32)
function encodeInPool(hashId) {
  // keccak256('inPool(bytes32)') = first 4 bytes
  const selector = '0x9b8e7a0c'; // need to compute
  const padded = hashId.slice(2).padStart(64, '0');
  return selector + padded;
}

// Actually compute selector properly
import { createHash } from 'crypto';
function keccak256(str) {
  // use node crypto - but need actual keccak not sha256
  // Let's use a different approach - call eth_call with the ABI encoded data
  return null;
}

// Use viem-style manual encoding
// inPool(bytes32) selector = first 4 bytes of keccak256('inPool(bytes32)')
// = 0x9b8e7a0c... let me just use the RPC directly

const NEW_HASHIDS = [
  '0xa62831366cceaf8e3a8c528696ec9b5d36685bfa7d54afffdc08f3a812fbe87c', // 10004
  '0x413f30c0b85bd3a787b40a8b4152fa3a40c1362525a0ad4620eecaf098ba67e4', // 10251
  '0x92778fcc6975840b06c7d843b84e0ae3af2bef4d1fb0c208f1fcb4c309668b90', // 10261
  '0x0d2594fa174377c84f219237498968a45df3e6e59e205970a6439eb670a23043', // 10312
];

const TOKEN_MAP = {
  '0xa62831366cceaf8e3a8c528696ec9b5d36685bfa7d54afffdc08f3a812fbe87c': 10004,
  '0x413f30c0b85bd3a787b40a8b4152fa3a40c1362525a0ad4620eecaf098ba67e4': 10251,
  '0x92778fcc6975840b06c7d843b84e0ae3af2bef4d1fb0c208f1fcb4c309668b90': 10261,
  '0x0d2594fa174377c84f219237498968a45df3e6e59e205970a6439eb670a23043': 10312,
};

// inPool(bytes32) — function selector
// keccak256('inPool(bytes32)') first 4 bytes
// We know it's a mapping: inPool(bytes32 ) => bool
// Let me compute using eth_call

// selector for inPool(bytes32): 0x9b8e7a0c
// Actually let me verify by checking depositor(bytes32) instead which returns address
// depositor(bytes32) selector

async function depositorOf(hashId) {
  // depositor(bytes32) - returns address of who deposited it
  // selector = keccak256('depositor(bytes32)')[0:4]
  // = 0x4e69a42f
  const data = '0x4e69a42f' + hashId.slice(2).padStart(64, '0');
  const result = await call('eth_call', [{ to: PROXY, data }, 'latest']);
  if (!result || result === '0x') return null;
  return '0x' + result.slice(26); // last 20 bytes = address
}

async function inPool(hashId) {
  // inPool(bytes32) - returns bool
  // selector = keccak256('inPool(bytes32)')[0:4]
  // = 0x9b8e7a0c
  const data = '0x9b8e7a0c' + hashId.slice(2).padStart(64, '0');
  const result = await call('eth_call', [{ to: PROXY, data }, 'latest']);
  if (!result || result === '0x') return null;
  return result !== '0x' + '0'.repeat(64);
}

console.log('=== ON-CHAIN CONTRACT CHECK ===');
console.log('Contract:', PROXY);

// Check pool size first
const poolSizeData = await call('eth_call', [{ to: PROXY, data: '0x18160ddd' }, 'latest']); // poolSize()
// selector for poolSize() = keccak256('poolSize()')[0:4]
const poolSizeData2 = await call('eth_call', [{ to: PROXY, data: '0x8060e0b1' }, 'latest']); // poolSize()
console.log('poolSize raw:', poolSizeData, poolSizeData2);

console.log('\nChecking depositor for sample hashIds:');
for (const hashId of NEW_HASHIDS) {
  const dep = await depositorOf(hashId);
  const pool = await inPool(hashId);
  console.log(`#${TOKEN_MAP[hashId]}: depositor=${dep} inPool=${pool}`);
}
