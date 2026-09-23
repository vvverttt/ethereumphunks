// Deposit calldata for the treasury lots -> auction house pool.
//
// The house takes deposits through its FALLBACK: a tx from the owner whose calldata is
// nothing but 32-byte hashIds laid end to end. That one tx is simultaneously the
// Ethscriptions-protocol transfer (the indexer reads calldata divisible by 32 as a batch
// transfer) and the on-chain pool registration. No function selector, no ABI.
//
// Read-only. Writes the calldata for a wallet to send by hand; nothing is broadcast here.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JsonRpcProvider, formatEther } = require('./contracts/node_modules/ethers');
import fs from 'fs';

const AUCTION = '0xc1fa86b53e8e101c93c570f276bc5177832bd031';
const SRC = './v67_new1066/treasury-auction-final.json';
const OUT = './v67_new1066/treasury-deposit-calldata.json';
const PER_TX = Number(process.env.PER_TX || 25);

const { lots, held } = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const provider = new JsonRpcProvider(process.env.RPC_URL || 'https://eth.drpc.org');
const owner = (await provider.resolveName('quantumphunks.eth')).toLowerCase();

for (const l of lots) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(l.hashId)) throw new Error(`bad hashId on #${l.tokenId}: ${l.hashId}`);
}
const heldSet = new Set(held.map((h) => h.hashId));
if (lots.some((l) => heldSet.has(l.hashId))) throw new Error('a held-back item is in the lot list');

const batches = [];
for (let i = 0; i < lots.length; i += PER_TX) {
  const slice = lots.slice(i, i + PER_TX);
  batches.push({
    n: slice.length,
    tokenIds: slice.map((l) => l.tokenId),
    data: '0x' + slice.map((l) => l.hashId.slice(2)).join(''),
  });
}

console.log(`${lots.length} lots -> ${batches.length} deposit tx(s) of up to ${PER_TX}`);
console.log(`from ${owner}  ->  to ${AUCTION}  (value 0, no selector)\n`);

const fee = await provider.getFeeData();
let totalGas = 0n;
for (const [i, b] of batches.entries()) {
  let gas;
  try {
    gas = await provider.estimateGas({ from: owner, to: AUCTION, data: b.data, value: 0 });
  } catch (e) {
    gas = null;
    b.estimateError = String(e.shortMessage || e.message).slice(0, 120);
  }
  b.gas = gas ? Number(gas) : null;
  if (gas) totalGas += gas;
  console.log(`  tx ${i + 1}: ${String(b.n).padStart(2)} items  ${b.data.length - 2} hex chars  gas ${gas ? Number(gas).toLocaleString() : 'ESTIMATE FAILED — ' + b.estimateError}`);
  console.log(`         #${b.tokenIds.join(', #')}`);
}

if (totalGas) {
  console.log(`\n  total gas ${Number(totalGas).toLocaleString()}`);
  for (const gwei of [0.08, 0.1, 0.15]) {
    console.log(`    @${gwei} gwei  ${(Number(totalGas) * gwei / 1e9).toFixed(5)} ETH`);
  }
}
console.log(`\n  network right now: ${fee.gasPrice ? (Number(fee.gasPrice) / 1e9).toFixed(3) : '?'} gwei`);

fs.writeFileSync(OUT, JSON.stringify({
  note: 'send each `data` to the auction house from the owner wallet, value 0, no function selector — the fallback registers the pool entries and the same calldata is the ethscription batch transfer',
  built_at: new Date().toISOString(),
  from: owner, to: AUCTION,
  lots: lots.length, heldBack: held.map((h) => h.tokenId),
  batches,
}, null, 2));
console.log(`\nwrote ${OUT}`);
