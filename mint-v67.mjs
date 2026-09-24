/**
 * mint-v67.mjs
 *
 * Mints the populated (image + traits already written) tokens to a destination.
 * Destination is an explicit argument — never a default — because a mint cannot be
 * undone and the owner can only be changed afterwards by the token holder.
 *
 *   node mint-v67.mjs --to 0x...                 dry run, all unminted
 *   RUN=1 node mint-v67.mjs --to 0x... --limit 1 mint a single token first
 *   RUN=1 node mint-v67.mjs --to 0x...           the rest
 *
 * env: BATCH (default 400) · MAX_GWEI (default 0.06) · PRIVATE_KEY
 * Skips anything already minted, so it is safe to re-run.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JsonRpcProvider, Wallet, Contract, formatEther, formatUnits, parseUnits, getAddress } = require('./contracts/node_modules/ethers');

const PROXY = '0x67b850c3c8790cc7ec76261b65fde60efb6f1fe3';
// Which batch to mint. Defaults to the 4677 drop so existing invocations are unchanged;
// the final 1,054 pass OUT/URIS, the same convention populate-v67-new4677.mjs uses.
const OUT = process.env.OUT || './v67_new4677';
const URIS_FILE = process.env.URIS || 'cryptophunksv67_new4677_dataURIs.json';
const PROGRESS = `${OUT}/.mint-progress.json`;
const RUN = process.env.RUN === '1';
const BATCH = Number(process.env.BATCH || 400);
const MAX_GWEI = Number(process.env.MAX_GWEI || 0.06);

const argv = process.argv.slice(2);
const arg = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const LIMIT = arg('--limit') ? Number(arg('--limit')) : Infinity;
let TO;
try { TO = getAddress(arg('--to') || ''); }
catch { console.error('need a valid --to <address>'); process.exit(1); }

const ABI = [
  'function ownerMintBatch(address to, uint256[] tokenIds)',
  'function ownerOf(uint256) view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
];

const uris = JSON.parse(readFileSync(`${OUT}/${URIS_FILE}`, 'utf8'));
const ids = Object.keys(uris).map(Number).sort((a, b) => a - b);

const provider = new JsonRpcProvider(process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com');
const wallet = RUN ? new Wallet(readFileSync('./.burner-v67', 'utf8').trim(), provider) : null;
const c = new Contract(PROXY, ABI, wallet ?? provider);

console.log(`mint target : ${TO}`);
console.log(`candidates  : ${ids.length} populated tokens`);

// a contract destination must accept safeMint, or every batch reverts
const code = await provider.getCode(TO);
if (code !== '0x') {
  const r = await provider.call({ from: PROXY, to: TO, data: '0x150b7a02' + '0'.repeat(56) })
    .catch(() => null);
  console.log(`destination : CONTRACT (${(code.length - 2) / 2} bytes) — verify it implements onERC721Received`);
} else console.log('destination : EOA');

if (RUN) {
  const onchainOwner = (await c.owner()).toLowerCase();
  if (onchainOwner !== wallet.address.toLowerCase()) {
    console.error(`ABORT: contract owner is ${onchainOwner}, signer is ${wallet.address.toLowerCase()}`);
    process.exit(1);
  }
}

// find what still needs minting — ask the chain, not a local file
process.stdout.write('checking which are already minted… ');
const done = new Set(existsSync(PROGRESS) ? JSON.parse(readFileSync(PROGRESS, 'utf8')).minted : []);
const probe = ids.filter(t => !done.has(t));
const CH = 40;
for (let i = 0; i < probe.length; i += CH) {
  const slice = probe.slice(i, i + CH);
  const body = slice.map((t, k) => ({ jsonrpc: '2.0', id: k, method: 'eth_call',
    params: [{ to: PROXY, data: c.interface.encodeFunctionData('ownerOf', [t]) }, 'latest'] }));
  try {
    const res = await (await fetch(provider._getConnection().url, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
    if (Array.isArray(res)) for (const r of res) if (typeof r.result === 'string' && r.result.startsWith('0x')) done.add(slice[r.id]);
  } catch {}
  process.stdout.write(`\rchecking which are already minted… ${Math.min(i + CH, probe.length)}/${probe.length}`);
}
const pending = ids.filter(t => !done.has(t));
console.log(`\nalready minted: ${done.size}   to mint: ${pending.length}`);
if (!pending.length) { console.log('nothing to do'); process.exit(0); }

const batches = [];
for (let i = 0; i < pending.length; i += BATCH) batches.push(pending.slice(i, i + BATCH));
const run = batches.slice(0, Math.ceil(Math.min(LIMIT, pending.length) / BATCH));
if (LIMIT < BATCH) run[0] = run[0].slice(0, LIMIT);

console.log(`batches     : ${run.length} x up to ${BATCH}   mode ${RUN ? 'SEND' : 'DRY RUN'}`);
console.log('');

let total = 0n, spent = 0n;
const minted = [...done];
for (let i = 0; i < run.length; i++) {
  const b = run[i];
  const data = c.interface.encodeFunctionData('ownerMintBatch', [TO, b]);
  const gas = await provider.estimateGas({ from: RUN ? wallet.address : await c.owner(), to: PROXY, data });
  total += gas;
  const tag = `${i + 1}/${run.length} (${b.length} ids, #${b[0]}–#${b[b.length - 1]})`;
  if (!RUN) { console.log(`  ${tag}  est ${gas.toString().padStart(10)} gas`); continue; }

  const blk = await provider.getBlock('latest');
  const base = blk.baseFeePerGas;
  if (Number(formatUnits(base, 'gwei')) > MAX_GWEI) { console.log(`  baseFee over ${MAX_GWEI} — stopping`); break; }
  const tip = parseUnits('0.001', 'gwei');
  const cap = parseUnits(String(MAX_GWEI), 'gwei');
  const want = base * 2n + tip;
  const tx = await wallet.sendTransaction({ to: PROXY, data, gasLimit: gas * 12n / 10n,
    maxFeePerGas: want > cap ? cap : want, maxPriorityFeePerGas: tip });
  process.stdout.write(`  ${tag}  ${tx.hash} …`);
  const r = await tx.wait(1);
  if (r.status !== 1) { console.error(' REVERTED'); break; }
  spent += r.gasUsed * r.gasPrice;
  console.log(` ok ${r.gasUsed} gas  ${formatEther(r.gasUsed * r.gasPrice)} ETH`);
  minted.push(...b);
  writeFileSync(PROGRESS, JSON.stringify({ to: TO, minted }, null, 2));
}

console.log('');
if (RUN) {
  console.log(`spent ${formatEther(spent)} ETH`);
  console.log(`totalSupply now ${await c.totalSupply()}   destination holds ${await c.balanceOf(TO)}`);
} else {
  const px = (await provider.getBlock('latest')).baseFeePerGas;
  console.log(`estimated ${total} gas ≈ ${formatEther(total * px)} ETH at current baseFee`);
}
