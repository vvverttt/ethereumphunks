// Point the live proxy at the flip implementation.
//
// Reads tokenURI BEFORE and AFTER in the same run, so the change is demonstrated rather
// than asserted, and re-checks the core invariants (supply, owner, an owner of a token)
// immediately after to prove storage survived.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JsonRpcProvider, Wallet, Contract, formatEther, formatUnits, parseUnits } = require('./contracts/node_modules/ethers');
require('./contracts/node_modules/dotenv').config();
import fs from 'fs';

const PROXY = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';
const SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const NEW = JSON.parse(fs.readFileSync('./v67_new1066/flip-impl.json', 'utf8')).implementation;
const MAX_GWEI = Number(process.env.MAX_GWEI || 0.09);
const RUN = process.env.RUN === '1';

const p = new JsonRpcProvider(process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com', 1, { staticNetwork: true });
const w = new Wallet(process.env.PRIVATE_KEY, p);
const abi = [
  'function upgradeToAndCall(address newImplementation, bytes data) payable',
  'function owner() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function tokenURI(uint256) view returns (string)',
  'function ownerOf(uint256) view returns (address)',
  'function backgroundColor() view returns (string)',
];
const c = new Contract(PROXY, abi, w);

const before = {
  impl: '0x' + (await p.getStorage(PROXY, SLOT)).slice(26),
  supply: (await c.totalSupply()).toString(),
  owner: await c.owner(),
  bg: await c.backgroundColor(),
  own4: await c.ownerOf(4),
  uri4: await c.tokenURI(4),
};
const j0 = JSON.parse(Buffer.from(before.uri4.split(',')[1], 'base64').toString());

console.log('BEFORE');
console.log(`  implementation  ${before.impl}`);
console.log(`  totalSupply     ${before.supply}   owner ${before.owner}`);
console.log(`  backgroundColor ${before.bg}   #4 owner ${before.own4}`);
console.log(`  #4 animation_url ${'animation_url' in j0 ? 'present' : 'ABSENT'}`);
console.log(`\nupgrading to ${NEW}`);

if (before.impl.toLowerCase() === NEW.toLowerCase()) { console.log('already on it — nothing to do'); process.exit(0); }
if (before.owner.toLowerCase() !== w.address.toLowerCase()) { console.error('ABORT: signer is not the owner'); process.exit(1); }

const blk = await p.getBlock('latest');
const base = blk.baseFeePerGas;
const gwei = Number(formatUnits(base, 'gwei'));
console.log(`  baseFee ${gwei.toFixed(4)} gwei (cap ${MAX_GWEI})`);
if (gwei > MAX_GWEI) { console.error('ABORT: over cap'); process.exit(1); }
if (!RUN) { console.log('\nDRY RUN — nothing sent.'); process.exit(0); }

const data = c.interface.encodeFunctionData('upgradeToAndCall', [NEW, '0x']);
const gas = await p.estimateGas({ from: w.address, to: PROXY, data });
const tip = parseUnits('0.001', 'gwei');
const cap = parseUnits(String(MAX_GWEI), 'gwei');
const want = base * 2n + tip;
const tx = await w.sendTransaction({ to: PROXY, data, gasLimit: (gas * 13n) / 10n,
  maxFeePerGas: want > cap ? cap : want, maxPriorityFeePerGas: tip });
console.log(`\n  ${tx.hash} …`);
const r = await tx.wait(1);
if (r.status !== 1) { console.error('  REVERTED'); process.exit(1); }
console.log(`  ok  ${r.gasUsed} gas  ${formatEther(r.gasUsed * r.gasPrice)} ETH`);

const after = {
  impl: '0x' + (await p.getStorage(PROXY, SLOT)).slice(26),
  supply: (await c.totalSupply()).toString(),
  owner: await c.owner(),
  bg: await c.backgroundColor(),
  own4: await c.ownerOf(4),
};
const j1 = JSON.parse(Buffer.from((await c.tokenURI(4)).split(',')[1], 'base64').toString());

console.log('\nAFTER');
console.log(`  implementation  ${after.impl}   ${after.impl.toLowerCase() === NEW.toLowerCase() ? 'SWITCHED' : 'NOT SWITCHED'}`);
console.log(`  totalSupply     ${after.supply}   ${after.supply === before.supply ? 'unchanged' : 'CHANGED!'}`);
console.log(`  owner           ${after.owner}   ${after.owner === before.owner ? 'unchanged' : 'CHANGED!'}`);
console.log(`  backgroundColor ${after.bg}   ${after.bg === before.bg ? 'unchanged' : 'CHANGED!'}`);
console.log(`  #4 owner        ${after.own4}   ${after.own4 === before.own4 ? 'unchanged' : 'CHANGED!'}`);
console.log(`  #4 name         ${j1.name}`);
console.log(`  #4 image        ${j1.image.length} chars (was ${j0.image.length})`);
console.log(`  #4 animation_url ${'animation_url' in j1 ? j1.animation_url.length + ' chars' : 'ABSENT'}`);
if (j1.animation_url) {
  const html = Buffer.from(j1.animation_url.split(',')[1], 'base64').toString();
  console.log(`  #4 flip handler  ${html.includes('classList.toggle') ? 'PRESENT' : 'MISSING'}`);
  console.log(`  #4 background    ${(html.match(/background:#[0-9a-f]{6}/i) || ['?'])[0]}`);
}
