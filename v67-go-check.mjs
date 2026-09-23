// Pre-flight for the v67 final batch. Run this before saying go.
//
// Every line is either OK or it is not — no "probably". Anything that would stop a run,
// or silently write the wrong thing, is checked here against the chain and the files
// rather than against memory of how things were left.
//
// Read-only. Never prints a private key.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JsonRpcProvider, Contract, Interface, Wallet, formatEther, formatUnits } = require('./contracts/node_modules/ethers');
require('./contracts/node_modules/dotenv').config();
import fs from 'fs';

const V67 = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const OUT = './v67_new1066';
const RPC = process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com';

const rows = [];
const ok = (label, detail) => rows.push(['OK  ', label, detail]);
const no = (label, detail) => rows.push(['TODO', label, detail]);
const bad = (label, detail) => rows.push(['FAIL', label, detail]);

const p = new JsonRpcProvider(RPC, 1, { staticNetwork: true });
const v67 = new Contract(V67, [
  'function owner() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function tokenImage(uint256) view returns (string)',
], p);

// ── payload ──
let ids = [], uris = {}, traits = {};
try {
  uris = JSON.parse(fs.readFileSync(`${OUT}/dataURIs-1054.json`, 'utf8'));
  traits = JSON.parse(fs.readFileSync(`${OUT}/setTraits-1054.json`, 'utf8'));
  ids = Object.keys(uris).map(Number).sort((a, b) => a - b);
  if (ids.length === 1054 && Object.keys(traits).length === 1054) ok('payload', '1,054 images + 1,054 trait sets');
  else bad('payload', `${ids.length} images / ${Object.keys(traits).length} traits — expected 1,054 of each`);
} catch (e) { bad('payload', `unreadable: ${e.message}`); }

const schemaBad = ids.filter((i) => {
  const t = traits[i];
  return !t || !Array.isArray(t.keys) || !Array.isArray(t.vals) || t.keys.length !== t.vals.length
    || typeof uris[i] !== 'string' || !uris[i].startsWith('data:image/png;base64,');
});
schemaBad.length ? bad('schema', `${schemaBad.length} malformed: ${schemaBad.slice(0, 5).join(', ')}`)
                 : ok('schema', 'keys/vals paired, every image a png data URI');

// ── id accounting over the whole collection ──
const drop = JSON.parse(fs.readFileSync(`${OUT}/turtle-drop-12.json`, 'utf8'));
const live = new Set(JSON.parse(fs.readFileSync(`${OUT}/live-ids.json`, 'utf8')).ids);
const turtles = new Set(drop.turtleSlots);
const W = new Set(ids);
let uncovered = 0, doubled = 0;
for (let i = 1; i <= 10000; i++) {
  const n = (live.has(i) ? 1 : 0) + (W.has(i) ? 1 : 0) + (turtles.has(i) ? 1 : 0);
  if (n === 0) uncovered++; if (n > 1) doubled++;
}
(uncovered || doubled)
  ? bad('id accounting', `${uncovered} ids covered by nothing, ${doubled} covered twice`)
  : ok('id accounting', `all 10,000 ids covered exactly once (${live.size} live + ${W.size} write + ${turtles.size} turtle)`);

// ── chain ──
const supply = Number(await v67.totalSupply());
supply === live.size ? ok('live count', `totalSupply ${supply} matches the guard file`)
                     : bad('live count', `chain says ${supply}, guard file says ${live.size} — REBUILD the guard`);

const mc = new Interface(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[])']);
const all = [...ids, ...drop.turtleSlots].sort((a, b) => a - b);
let occupied = 0, unreadable = 0;
process.stdout.write(`reading tokenImage for ${all.length} slots… `);
for (let i = 0; i < all.length; i += 40) {
  const slice = all.slice(i, i + 40);
  const calls = slice.map((t) => ({ target: V67, allowFailure: true, callData: v67.interface.encodeFunctionData('tokenImage', [t]) }));
  const [res] = mc.decodeFunctionResult('aggregate3', await p.call({ to: MULTICALL3, data: mc.encodeFunctionData('aggregate3', [calls]) }));
  res.forEach((r) => {
    if (!r.success) return unreadable++;
    try { if (v67.interface.decodeFunctionResult('tokenImage', r.returnData)[0].length > 0) occupied++; }
    catch { unreadable++; }
  });
}
process.stdout.write('done\n\n');
unreadable ? bad('on-chain slots', `${unreadable} unreadable — cannot certify`)
  : occupied ? bad('on-chain slots', `${occupied} ALREADY HOLD ART — writing would erase it`)
  : ok('on-chain slots', `all ${all.length} empty, nothing would be overwritten`);

// ── burner ──
let burner = null;
try {
  burner = new Wallet(process.env.PRIVATE_KEY).address;
  ok('burner key', `${burner} (loaded from .env, not printed)`);
} catch { bad('burner key', 'PRIVATE_KEY missing or invalid in .env'); }

if (burner) {
  const bal = await p.getBalance(burner);
  const eth = Number(formatEther(bal));
  eth >= 0.08 ? ok('burner funded', `${formatEther(bal)} ETH`)
    : no('burner funded', `${formatEther(bal)} ETH — send 0.08 to ${burner}`);

  const owner = await v67.owner();
  owner.toLowerCase() === burner.toLowerCase()
    ? ok('contract owner', 'burner owns CryptoPhunksV67')
    : no('contract owner', `owned by ${owner} — transferOwnership to ${burner}`);
}

// ── art ──
const drawn = drop.turtleSlots.filter((t) => uris[t]);
drawn.length === drop.turtleSlots.length
  ? ok('turtle art', `all ${drop.turtleSlots.length} turtles in the payload`)
  : no('turtle art', `${drop.turtleSlots.length - drawn.length} of ${drop.turtleSlots.length} still to draw`);

// ── gas ──
const blk = await p.getBlock('latest');
const gwei = Number(formatUnits(blk.baseFeePerGas ?? 0n, 'gwei'));
const GAS = 773764308 + 30200000;
ok('cost at current gas', `baseFee ${gwei.toFixed(4)} gwei -> ${(GAS * gwei / 1e9).toFixed(4)} ETH for the whole run`);
ok('cost at 0.08 gwei', `${(GAS * 0.08 / 1e9).toFixed(4)} ETH (803.9M gas: 774M images+traits, 30M mint)`);

// ── report ──
const w = Math.max(...rows.map((r) => r[1].length));
for (const [s, l, d] of rows) console.log(`  [${s}] ${l.padEnd(w)}  ${d}`);

const fails = rows.filter((r) => r[0] === 'FAIL').length;
const todos = rows.filter((r) => r[0] === 'TODO').length;
console.log('');
if (fails) console.log(`  ${fails} FAILURE(S) — do not run until these are fixed.`);
else if (todos) console.log(`  No failures. ${todos} thing(s) still to do before the run can start.`);
else console.log('  READY. Nothing outstanding.');

console.log(`\n  when it is time:`);
console.log(`    OUT=./v67_new1066 URIS=dataURIs-1054.json TRAITS=setTraits-1054.json \\`);
console.log(`      GUARD=live-ids.json EXPECT=1054 MAX_GWEI=0.08 RUN=1 node populate-v67-new4677.mjs`);
console.log(`  (PRIVATE_KEY comes from .env. Drop RUN=1 for a dry run. Create a file named PAUSE to park it.)`);
