// Ask the CONTRACT — not a file — whether any slot we are about to write already holds art.
//
// This is the guard that failed before: the writer trusted a static list that was months
// stale and would have overwritten live art. `tokenImage(uint256)` reads image storage
// directly and does NOT require the token to be minted, so it sees art written ahead of a
// mint — exactly the case the stale file was blind to.
//
// Read-only. Batched through Multicall3 so 1,081 slots cost ~22 requests, and cross-checked
// on a second public RPC so one bad node cannot green-light an overwrite.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JsonRpcProvider, Interface, Contract } = require('./contracts/node_modules/ethers');
import fs from 'fs';

const V67 = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const OUT = './v67_new1066';
const CHUNK = 40;

const RPCS = (process.env.RPCS || 'https://ethereum-rpc.publicnode.com,https://eth.drpc.org,https://rpc.mevblocker.io').split(',');

const v67 = new Interface([
  'function tokenImage(uint256) view returns (string)',
  'function tokenSha(uint256) view returns (string)',
  'function ownerOf(uint256) view returns (address)',
  'function totalSupply() view returns (uint256)',
]);
const mc = new Interface([
  'function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[])',
]);

const uris = JSON.parse(fs.readFileSync(`${OUT}/dataURIs-1054.json`, 'utf8'));
const drop = JSON.parse(fs.readFileSync(`${OUT}/turtle-drop-12.json`, 'utf8'));
const TO_WRITE = Object.keys(uris).map(Number).sort((a, b) => a - b);
const TURTLE_SLOTS = drop.turtleSlots.slice().sort((a, b) => a - b);
const ALL = [...TO_WRITE, ...TURTLE_SLOTS].sort((a, b) => a - b);

if (new Set(ALL).size !== ALL.length) throw new Error('an id appears in both the write list and the turtle slots');
if (ALL.length !== 1081) throw new Error(`expected 1,081 slots to audit, got ${ALL.length}`);

async function imagesOn(rpcUrl, ids) {
  const p = new JsonRpcProvider(rpcUrl, 1, { staticNetwork: true });
  const out = new Map();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const calls = slice.map((id) => ({ target: V67, allowFailure: true, callData: v67.encodeFunctionData('tokenImage', [id]) }));
    const raw = await p.call({ to: MULTICALL3, data: mc.encodeFunctionData('aggregate3', [calls]) });
    const [res] = mc.decodeFunctionResult('aggregate3', raw);
    slice.forEach((id, k) => {
      const r = res[k];
      let len = 0;
      if (r.success) {
        try { len = v67.decodeFunctionResult('tokenImage', r.returnData)[0].length; } catch { len = -1; }
      } else len = -2; // reverted
      out.set(id, len);
    });
    process.stdout.write(`\r  ${rpcUrl.replace('https://', '').padEnd(28)} ${Math.min(i + CHUNK, ids.length)}/${ids.length}   `);
  }
  process.stdout.write('\n');
  return out;
}

console.log(`auditing ${ALL.length} slots against ${V67}\n`);

const primary = RPCS[0];
const supply = await new Contract(V67, v67, new JsonRpcProvider(primary, 1, { staticNetwork: true })).totalSupply();
console.log(`totalSupply on chain: ${supply}\n`);

const a = await imagesOn(primary, ALL);

const occupied = ALL.filter((id) => (a.get(id) || 0) > 0);
const empty = ALL.filter((id) => (a.get(id) || 0) === 0);
const weird = ALL.filter((id) => a.get(id) < 0);

console.log(`\n  empty (safe to write)   ${empty.length}`);
console.log(`  ALREADY HAS ART         ${occupied.length}`);
console.log(`  unreadable / reverted   ${weird.length}`);

// Anything that looks occupied gets confirmed on a second, independent node before it is
// reported — a single flaky RPC must never be the reason art is or is not overwritten.
let confirmed = [];
if (occupied.length || weird.length) {
  const suspect = [...occupied, ...weird];
  console.log(`\nconfirming ${suspect.length} on a second RPC...`);
  for (const rpc of RPCS.slice(1)) {
    try {
      const b = await imagesOn(rpc, suspect);
      confirmed = suspect.filter((id) => (b.get(id) || 0) > 0);
      console.log(`  ${rpc}: ${confirmed.length} confirmed occupied`);
      break;
    } catch (e) { console.log(`  ${rpc} failed: ${String(e.shortMessage || e.message).slice(0, 80)}`); }
  }
}

const collisions = confirmed.length ? confirmed : occupied;
if (collisions.length) {
  console.log(`\n!! ${collisions.length} SLOTS ALREADY HOLD ART — writing these would erase it:`);
  for (const id of collisions.slice(0, 60)) {
    const where = TURTLE_SLOTS.includes(id) ? 'TURTLE SLOT' : 'in write list';
    console.log(`   #${String(id).padEnd(6)} ${String(a.get(id)).padStart(5)} chars   ${where}`);
  }
  if (collisions.length > 60) console.log(`   ... and ${collisions.length - 60} more`);
} else {
  console.log('\nOK — every one of the 1,081 slots is empty on chain. Nothing would be overwritten.');
}

fs.writeFileSync(`${OUT}/onchain-slot-audit.json`, JSON.stringify({
  note: 'tokenImage() read straight off the contract for every slot the batch would touch; length 0 = no art stored',
  built_at: new Date().toISOString(),
  contract: V67, rpc: primary, totalSupply: Number(supply),
  audited: ALL.length, writeList: TO_WRITE.length, turtleSlots: TURTLE_SLOTS.length,
  empty: empty.length, occupied: collisions.length, unreadable: weird.length,
  collisions: collisions.map((id) => ({ tokenId: id, imageChars: a.get(id), role: TURTLE_SLOTS.includes(id) ? 'turtle-slot' : 'write-list' })),
}, null, 2));
console.log(`\nwrote ${OUT}/onchain-slot-audit.json`);
