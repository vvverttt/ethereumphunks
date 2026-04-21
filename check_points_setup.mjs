const RPC = 'https://rpc.mevblocker.io';
async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return (await res.json()).result;
}

// Addresses from environment.mainnet.ts
const POINTS    = '0xa22a3e40c3c5a01f802c5698af6ed5faa21095eb';
const MARKET    = '0x'; // need to find
const AUCTION   = '0x'; // need to find
const LOTTERY   = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';
const LOTTERY2  = '0x298771ecc338de242ada11e49e2b8224c33bf620';

// Read 4-byte selectors
const sel = (sig) => {
  // Simple keccak-like lookup for known sigs
  const sigs = {
    'pointsAddress()': '0x74f72d4e',
    'paused()': '0x5c975abb',
    'multiplier()': '0x7cd0723a',
  };
  return sigs[sig];
};

async function call(to, sig) {
  const data = sel(sig);
  if (!data) return 'unknown selector';
  const result = await rpc('eth_call', [{ to, data }, 'latest']);
  if (!result || result === '0x') return 'no result';
  // Decode address (last 20 bytes of 32-byte result)
  if (result.length === 66) return '0x' + result.slice(26);
  return result;
}

// Read from environment files
import { readFileSync } from 'fs';
const mainnetEnv = readFileSync('./marketplace/src/environments/environment.mainnet.ts', 'utf8');
const extractAddr = (key) => {
  const match = mainnetEnv.match(new RegExp(`${key}:\\s*'(0x[^']+)'`));
  return match ? match[1].toLowerCase() : null;
};

const marketAddr   = extractAddr('marketAddress');
const auctionAddr  = extractAddr('auctionAddress');
const pointsAddr   = extractAddr('pointsAddress');

console.log('=== Points Contract Setup ===');
console.log(`Expected points address: ${pointsAddr}`);
console.log(`Market contract:  ${marketAddr || '(not set)'}`);
console.log(`Auction contract: ${auctionAddr || '(not set)'}`);
console.log(`Lottery (std):    ${LOTTERY}`);
console.log(`Lottery (1of1):   ${LOTTERY2}`);

console.log('\n=== Checking pointsAddress on each contract ===');

if (marketAddr) {
  const addr = await call(marketAddr, 'pointsAddress()');
  const ok = addr.toLowerCase() === pointsAddr;
  console.log(`Market pointsAddress:  ${addr} ${ok ? '✓' : '⚠️ MISMATCH'}`);
}

if (auctionAddr) {
  const addr = await call(auctionAddr, 'pointsAddress()');
  const ok = addr.toLowerCase() === pointsAddr;
  console.log(`Auction pointsAddress: ${addr} ${ok ? '✓' : '⚠️ MISMATCH'}`);
}

const lotteryPoints = await call(LOTTERY, 'pointsAddress()');
const ok1 = lotteryPoints.toLowerCase() === pointsAddr;
console.log(`Lottery std pointsAddress: ${lotteryPoints} ${ok1 ? '✓' : '⚠️ MISMATCH'}`);

const lottery2Points = await call(LOTTERY2, 'pointsAddress()');
const ok2 = lottery2Points.toLowerCase() === pointsAddr;
console.log(`Lottery 1of1 pointsAddress: ${lottery2Points} ${ok2 ? '✓' : '⚠️ MISMATCH'}`);

console.log('\n=== Points Contract State ===');
const paused = await rpc('eth_call', [{ to: pointsAddr, data: sel('paused()') }, 'latest']);
console.log(`Points paused: ${paused === '0x0000000000000000000000000000000000000000000000000000000000000001' ? 'YES ⚠️' : 'NO ✓'}`);

const mult = await rpc('eth_call', [{ to: pointsAddr, data: sel('multiplier()') }, 'latest']);
console.log(`Points multiplier: ${mult ? parseInt(mult, 16) : 'N/A'}`);
