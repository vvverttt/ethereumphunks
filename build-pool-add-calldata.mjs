// Calldata to add the 1,081 newly minted tokens to the lottery's winnable pool.
//
// The lottery holds 5,332 tokens but poolSize is 4,250 — the batch we wrote was minted
// INTO the contract but never added to `_activePool`, so it cannot be won.
//
// addPoolTokens is idempotent per id (`if (_poolIndexPlusOne[tokenId] == 0)`), so passing
// an id that is already pooled is a no-op rather than a revert. It DOES revert the whole
// batch if a token is reserved or owned by anyone but the lottery — both checked already.
//
// Read-only. Estimates each batch against live state so the gas figures are real.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JsonRpcProvider, Interface, formatUnits } = require('./contracts/node_modules/ethers');
import fs from 'fs';

const LOTTERY = '0x702862d4cb2E55452170814AAb9117cDE8287e61';
const OWNER = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';
const PER_TX = Number(process.env.PER_TX || 150);
const OUT = './v67_new1066/pool-add-calldata.json';

const ids = JSON.parse(fs.readFileSync('./v67_new1066/pool-add-ids.json', 'utf8')).ids;
const p = new JsonRpcProvider(process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com', 1, { staticNetwork: true });
const iface = new Interface(['function addPoolTokens(uint256[] tokenIds)']);

const batches = [];
for (let i = 0; i < ids.length; i += PER_TX) batches.push(ids.slice(i, i + PER_TX));

console.log(`${ids.length} ids -> ${batches.length} transactions of up to ${PER_TX}\n`);
console.log(`from ${OWNER}  ->  ${LOTTERY}  (value 0)\n`);

const gwei = Number(formatUnits((await p.getBlock('latest')).baseFeePerGas, 'gwei'));
let total = 0n;
const out = [];

for (const [i, b] of batches.entries()) {
  const data = iface.encodeFunctionData('addPoolTokens', [b]);
  let gas = null, err = null;
  try { gas = await p.estimateGas({ from: OWNER, to: LOTTERY, data, value: 0 }); total += gas; }
  catch (e) { err = String(e.shortMessage || e.message).slice(0, 110); }
  console.log(`  tx ${String(i + 1).padStart(2)}: ${b.length} ids  #${b[0]}–#${b[b.length - 1]}  ` +
    (gas ? `gas ${Number(gas).toLocaleString()}` : `ESTIMATE FAILED — ${err}`));
  out.push({ n: b.length, first: b[0], last: b[b.length - 1], gas: gas ? Number(gas) : null, ids: b, data });
}

if (total) {
  console.log(`\n  total gas ${Number(total).toLocaleString()}`);
  console.log(`  at ${gwei.toFixed(4)} gwei -> ${(Number(total) * gwei / 1e9).toFixed(5)} ETH`);
}
console.log(`\n  note: every batch estimating cleanly means each id passes isImageSet,`);
console.log(`  is unreserved, and is owned by the lottery — addPoolTokens checks all three.`);

fs.writeFileSync(OUT, JSON.stringify({
  note: 'send each `data` to the lottery from quantumphunks.eth, value 0',
  built_at: new Date().toISOString(),
  from: OWNER, to: LOTTERY, totalIds: ids.length,
  expectedPoolAfter: 4250 + ids.length,
  batches: out,
}, null, 2));
console.log(`\nwrote ${OUT}`);
console.log(`poolSize should go 4,250 -> ${4250 + ids.length}`);
