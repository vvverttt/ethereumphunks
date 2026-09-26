// Correct the Skin Tone on the 27 turtles.
//
// They went on chain carrying the collection's <Era> <Character> convention, when the
// artist's pop palette (Radioactive, Flamingo, Galaxy…) was what was wanted. Only that one
// value changes on each token; keys, order and Attribute Count stay as written.
//
// Deliberately NOT going through populate-v67-new4677.mjs: its guards exist to stop
// anything writing over a slot that already holds art, which is exactly what this does on
// purpose. A narrow script that checks the right things is safer than disabling the
// general one's safety rails.
//
// batchSetTraits assigns `_traitKeys[id] = keys[i]` — a replacement, not an append.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JsonRpcProvider, Wallet, Contract, formatEther, formatUnits, parseUnits } = require('./contracts/node_modules/ethers');
require('./contracts/node_modules/dotenv').config();
import fs from 'fs';

const PROXY = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';
const OUT = './v67_new1066';
const MAX_GWEI = Number(process.env.MAX_GWEI || 0.09);
const BATCH = Number(process.env.BATCH || 14);
const RUN = process.env.RUN === '1';

const fixed = JSON.parse(fs.readFileSync(`${OUT}/setTraits-27turtles-FIXED.json`, 'utf8'));
const was = JSON.parse(fs.readFileSync(`${OUT}/setTraits-27turtles.json`, 'utf8'));
const ids = Object.keys(fixed).map(Number).sort((a, b) => a - b);

// Only Skin Tone may differ, and every token must still be internally consistent.
for (const id of ids) {
  const a = was[id], b = fixed[id];
  if (JSON.stringify(a.keys) !== JSON.stringify(b.keys)) throw new Error(`#${id}: keys changed`);
  if (b.keys.length !== b.vals.length) throw new Error(`#${id}: length mismatch`);
  if (b.keys[b.keys.length - 1] !== 'Attribute Count') throw new Error(`#${id}: Attribute Count not last`);
  if (b.vals[b.vals.length - 1] !== String(b.keys.length - 1)) throw new Error(`#${id}: Attribute Count wrong`);
  b.vals.forEach((v, i) => { if (v !== a.vals[i] && b.keys[i] !== 'Skin Tone') throw new Error(`#${id}: ${b.keys[i]} changed`); });
}
if (ids.length !== 27) throw new Error(`expected 27, got ${ids.length}`);
console.log(`27 tokens, only Skin Tone differs on each — checks passed`);

const p = new JsonRpcProvider(process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com', 1, { staticNetwork: true });
const w = new Wallet(process.env.PRIVATE_KEY, p);
const c = new Contract(PROXY, [
  'function batchSetTraits(uint256[] t, string[][] keys, string[][] vals)',
  'function owner() view returns (address)',
  'function tokenURI(uint256) view returns (string)',
], w);

const owner = await c.owner();
if (owner.toLowerCase() !== w.address.toLowerCase()) { console.error(`ABORT: ${owner} owns it, not ${w.address}`); process.exit(1); }

const tone = async (id) => {
  const j = JSON.parse(Buffer.from((await c.tokenURI(id)).split(',')[1], 'base64').toString());
  return (j.attributes.find((a) => a.trait_type === 'Skin Tone') || {}).value;
};
console.log(`before: #${ids[0]} = "${await tone(ids[0])}"`);

if (!RUN) { console.log('\nDRY RUN — nothing sent. Re-run with RUN=1.'); process.exit(0); }

let spent = 0n;
for (let i = 0; i < ids.length; i += BATCH) {
  const s = ids.slice(i, i + BATCH);
  const data = c.interface.encodeFunctionData('batchSetTraits', [s, s.map((t) => fixed[t].keys), s.map((t) => fixed[t].vals)]);
  for (;;) {
    const blk = await p.getBlock('latest');
    const base = blk.baseFeePerGas;
    const g = Number(formatUnits(base, 'gwei'));
    if (g > MAX_GWEI) { console.log(`  baseFee ${g.toFixed(4)} > ${MAX_GWEI}, waiting 60s`); await new Promise((r) => setTimeout(r, 60000)); continue; }
    const gas = await p.estimateGas({ from: w.address, to: PROXY, data });
    const tip = parseUnits('0.001', 'gwei');
    const cap = parseUnits(String(MAX_GWEI), 'gwei');
    const want = base * 2n + tip;
    const tx = await w.sendTransaction({ to: PROXY, data, gasLimit: (gas * 12n) / 10n,
      maxFeePerGas: want > cap ? cap : want, maxPriorityFeePerGas: tip });
    process.stdout.write(`  ${s.length} tokens (#${s[0]}–#${s[s.length - 1]})  ${tx.hash} …`);
    const r = await tx.wait(1);
    if (r.status !== 1) { console.error(' REVERTED'); process.exit(1); }
    spent += r.gasUsed * r.gasPrice;
    console.log(` ok ${r.gasUsed} gas`);
    break;
  }
}

console.log(`\nspent ${formatEther(spent)} ETH`);
console.log('\nverifying every one against the chain:');
let bad = 0;
for (const id of ids) {
  const got = await tone(id);
  const want = fixed[id].vals[fixed[id].keys.indexOf('Skin Tone')];
  if (got !== want) { console.log(`  #${id}  FAIL  got "${got}" want "${want}"`); bad++; }
}
console.log(bad ? `  ${bad} WRONG` : `  all 27 correct`);
