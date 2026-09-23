/**
 * populate-v67-new4677.mjs
 *
 * Sets IMAGE + TRAITS on the live CryptoPhunksV67 proxy for the 4677 new tokenIds.
 * No provenance (no setTokenSha / setTokenHashId), no names (the contract builds
 * "QuantumPhunk #<id>" itself), no minting.
 *
 * Vanilla ethers on purpose — hardhat-ethers has the `to:''` creation-tx bug.
 *
 *   dry run :  node populate-v67-new4677.mjs
 *   send    :  RUN=1 PRIVATE_KEY=0x... node populate-v67-new4677.mjs
 *
 * env:
 *   PRIVATE_KEY  burner key that owns the contract (required to send)
 *   RPC_URL      default https://ethereum-rpc.publicnode.com
 *   MAX_GWEI     gas ceiling, default 0.04 — waits while the network is above it
 *   BATCH        items per tx, default 25
 *   ONLY         images | traits | both   (default both)
 *   LIMIT        stop after N batches (for a small live test)
 *
 * pause    : create a file named PAUSE next to this script; the run parks between
 *            batches until you delete it. Ctrl-C is also safe.
 * resume   : progress is written after every confirmed tx; just run it again.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JsonRpcProvider, Wallet, Contract, Interface, formatEther, parseUnits, formatUnits } = require('./contracts/node_modules/ethers');

const PROXY = '0x67b850c3c8790cc7ec76261b65fde60efb6f1fe3';

// Which batch this run targets. Defaults to the 4677 drop so existing invocations are
// unchanged; the final 1,066 pass OUT/URIS/TRAITS/GUARD/EXPECT instead of forking this
// file, so both batches go through one tested code path.
const OUT = process.env.OUT || './v67_new4677';
const URIS_FILE = process.env.URIS || 'cryptophunksv67_new4677_dataURIs.json';
const TRAITS_FILE = process.env.TRAITS || 'erc721_cryptophunksv67_new4677_setTraits.json';
// Live-id source for the collision guard. The original static file lists only the
// first 4,251 turtles and has been stale since the 4,667 were written, so a batch that
// collided with those would sail past it. Pass GUARD to use a freshly built list.
const GUARD_FILE = process.env.GUARD || null;

const PROGRESS = `${OUT}/.populate-progress.json`;
const PAUSE = './PAUSE';

const RUN = process.env.RUN === '1';
const RPC_URL = process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com';
const MAX_GWEI = Number(process.env.MAX_GWEI || 0.04);
const BATCH = Number(process.env.BATCH || 25);
const ONLY = (process.env.ONLY || 'both').toLowerCase();
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;

// Only the two setters that exist on the DEPLOYED impl. Note the inconsistent
// naming: setTokenImageBatch vs batchSetTraits. Neither is in the local .sol.
const ABI = [
  'function setTokenImageBatch(uint256[] t, string[] v)',
  'function batchSetTraits(uint256[] t, string[][] keys, string[][] vals)',
  'function owner() view returns (address)',
  'function totalSupply() view returns (uint256)',
  // Reads image storage directly and does NOT require the token to be minted, so it
  // sees art written ahead of a mint — the exact case a stale id list is blind to.
  'function tokenImage(uint256) view returns (string)',
];

const uris = JSON.parse(readFileSync(`${OUT}/${URIS_FILE}`, 'utf8'));
const traits = JSON.parse(readFileSync(`${OUT}/${TRAITS_FILE}`, 'utf8'));
const ids = Object.keys(uris).map(Number).sort((a, b) => a - b);

// ---------------------------------------------------------------- safety guard
// Already-live tokens must never appear in any calldata we build — overwriting one
// would replace real art on a token someone owns.
const liveIds = GUARD_FILE
  ? new Set(JSON.parse(readFileSync(`${OUT}/${GUARD_FILE}`, 'utf8')).ids)
  : new Set(JSON.parse(readFileSync('./tmp_quantumphunks_jsons/1 - CryptoPhunksV67.json', 'utf8')).collection_items.map(i => i.index));
const trespass = ids.filter(t => liveIds.has(t));
if (trespass.length) {
  console.error(`ABORT: ${trespass.length} target ids collide with live tokens: ${trespass.slice(0, 20).join(',')}`);
  process.exit(1);
}
const EXPECT = Number(process.env.EXPECT || 4667);
if (ids.length !== EXPECT) {
  console.error(`ABORT: expected ${EXPECT} targets, got ${ids.length}. Rebuild, or set EXPECT if the drop really changed size.`);
  process.exit(1);
}
if (Object.keys(traits).length !== ids.length) {
  console.error(`ABORT: ${ids.length} images but ${Object.keys(traits).length} trait entries — artifacts are out of sync, re-run build-v67-new4677.mjs`);
  process.exit(1);
}
for (const t of ids) {
  if (!uris[t] || !traits[t]) { console.error(`ABORT: #${t} missing image or traits`); process.exit(1); }
  if (traits[t].keys.length !== traits[t].vals.length) { console.error(`ABORT: #${t} key/val length mismatch`); process.exit(1); }
}
console.log(`guard ok — ${ids.length} targets, zero overlap with the ${liveIds.size} live tokens`);

// ------------------------------------------------------------------- progress
// Fingerprint the source artifacts. Swapping the art set invalidates saved progress —
// a tokenId marked done under the old images has NOT been written with the new ones.
const fingerprint = createHash('sha256')
  .update(readFileSync(`${OUT}/${URIS_FILE}`))
  .update(readFileSync(`${OUT}/${TRAITS_FILE}`))
  .digest('hex').slice(0, 16);

const progress = existsSync(PROGRESS)
  ? JSON.parse(readFileSync(PROGRESS, 'utf8'))
  : { images: [], traits: [], spentWei: '0', fingerprint };
if (progress.fingerprint && progress.fingerprint !== fingerprint) {
  console.error(`ABORT: progress file was written against a different art set (${progress.fingerprint} != ${fingerprint}).`);
  console.error(`Those tokenIds were NOT written with the current images. Delete ${PROGRESS} to start clean.`);
  process.exit(1);
}
const doneImg = new Set(progress.images);
const doneTr = new Set(progress.traits);
const save = () => writeFileSync(PROGRESS, JSON.stringify({
  images: [...doneImg], traits: [...doneTr], spentWei: progress.spentWei, fingerprint,
}, null, 2));

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const pendingImg = ids.filter(t => !doneImg.has(t));
const pendingTr = ids.filter(t => !doneTr.has(t));
const jobs = [];
if (ONLY === 'both' || ONLY === 'images') jobs.push({ kind: 'images', batches: chunk(pendingImg, BATCH) });
if (ONLY === 'both' || ONLY === 'traits') jobs.push({ kind: 'traits', batches: chunk(pendingTr, BATCH) });

console.log(`pending — images ${pendingImg.length}, traits ${pendingTr.length}`);
console.log(`batch ${BATCH}  cap ${MAX_GWEI} gwei  mode ${RUN ? 'SEND' : 'DRY RUN'}`);

const provider = new JsonRpcProvider(RPC_URL);
const wallet = RUN ? new Wallet(process.env.PRIVATE_KEY, provider) : null;
const c = new Contract(PROXY, ABI, wallet ?? provider);

// ------------------------------------------------------- on-chain collision guard
// The id-list guard above can only be as fresh as the file behind it, and that file
// went stale once already. This asks the contract itself: does any target slot ALREADY
// hold an image? If so, writing it would erase real art, so nothing is sent.
//
// Runs in dry-run too — the whole point is to find out before a send, not during one.
// Set SKIP_ONCHAIN_GUARD=1 only if you have separately proven the slots are empty.
if (process.env.SKIP_ONCHAIN_GUARD !== '1') {
  const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
  const mc = new Interface(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[])']);
  const occupied = [];
  let probed = 0, unreadable = 0;
  process.stdout.write('on-chain guard: reading tokenImage for every target… ');
  for (let i = 0; i < ids.length; i += 40) {
    const slice = ids.slice(i, i + 40);
    const calls = slice.map((t) => ({ target: PROXY, allowFailure: true, callData: c.interface.encodeFunctionData('tokenImage', [t]) }));
    const raw = await provider.call({ to: MULTICALL3, data: mc.encodeFunctionData('aggregate3', [calls]) });
    const [res] = mc.decodeFunctionResult('aggregate3', raw);
    slice.forEach((t, k) => {
      probed++;
      if (!res[k].success) { unreadable++; return; }
      let len = 0;
      try { len = c.interface.decodeFunctionResult('tokenImage', res[k].returnData)[0].length; }
      catch { unreadable++; return; }
      if (len > 0) occupied.push({ id: t, len });
    });
    process.stdout.write(`\ron-chain guard: ${probed}/${ids.length}   `);
  }
  process.stdout.write('\n');
  if (unreadable) {
    console.error(`ABORT: ${unreadable} of ${ids.length} slots could not be read — refusing to write blind. Retry, or use a different RPC_URL.`);
    process.exit(1);
  }
  if (occupied.length) {
    console.error(`ABORT: ${occupied.length} target slots ALREADY hold art on chain — writing would erase it:`);
    for (const o of occupied.slice(0, 20)) console.error(`   #${o.id}  ${o.len} chars`);
    if (occupied.length > 20) console.error(`   ... and ${occupied.length - 20} more`);
    process.exit(1);
  }
  console.log(`on-chain guard ok — all ${ids.length} slots are empty on chain`);
}

// EIP-1559, deliberately. A legacy `gasPrice` tx sent at 0.035 gwei becomes
// unmineable the moment baseFee rises above it and just sits in the mempool.
// With maxFeePerGas as a CEILING the tx stays includable across baseFee swings,
// and you still only pay baseFee + tip — so this is both cheaper and unstuck.
const TIP = parseUnits('0.001', 'gwei');
async function gasOk() {
  for (;;) {
    if (existsSync(PAUSE)) { console.log('  paused (delete ./PAUSE to resume)…'); await sleep(15000); continue; }
    const blk = await provider.getBlock('latest');
    const base = blk.baseFeePerGas ?? (await provider.getFeeData()).gasPrice;
    const gwei = Number(formatUnits(base, 'gwei'));
    if (gwei <= MAX_GWEI) {
      // headroom over the current base so a mid-flight rise doesn't strand it,
      // still capped so we never authorise more than MAX_GWEI
      const cap = parseUnits(String(MAX_GWEI), 'gwei');
      const want = base * 2n + TIP;
      return { maxFeePerGas: want > cap ? cap : want, maxPriorityFeePerGas: TIP, base };
    }
    console.log(`  baseFee ${gwei.toFixed(4)} gwei > cap ${MAX_GWEI} — waiting 60s`);
    await sleep(60000);
  }
}

const encode = (kind, b) => kind === 'images'
  ? c.interface.encodeFunctionData('setTokenImageBatch', [b, b.map(t => uris[t])])
  : c.interface.encodeFunctionData('batchSetTraits', [b, b.map(t => traits[t].keys), b.map(t => traits[t].vals)]);

if (RUN) {
  const onchainOwner = (await c.owner()).toLowerCase();
  if (onchainOwner !== wallet.address.toLowerCase()) {
    console.error(`ABORT: contract owner is ${onchainOwner}, signer is ${wallet.address.toLowerCase()}`);
    process.exit(1);
  }
  console.log(`signer ${wallet.address} owns the contract; balance ${formatEther(await provider.getBalance(wallet.address))} ETH`);
}

let totalGas = 0n, totalWei = BigInt(progress.spentWei), sent = 0;

for (const job of jobs) {
  console.log(`\n=== ${job.kind}: ${job.batches.length} batches ===`);
  for (let i = 0; i < job.batches.length && sent < LIMIT; i++) {
    const b = job.batches[i];
    const data = encode(job.kind, b);
    const tag = `${job.kind} ${i + 1}/${job.batches.length} (#${b[0]}–#${b[b.length - 1]})`;

    if (!RUN) {
      const gas = await provider.estimateGas({ from: await c.owner(), to: PROXY, data });
      totalGas += gas;
      console.log(`  ${tag}  est ${gas.toString().padStart(9)} gas`);
      sent++;
      continue;
    }

    const fees = await gasOk();
    const gas = await provider.estimateGas({ from: wallet.address, to: PROXY, data });
    const tx = await wallet.sendTransaction({
      to: PROXY, data, gasLimit: gas * 12n / 10n,
      maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
    });
    process.stdout.write(`  ${tag}  ${tx.hash} …`);
    const r = await tx.wait(1);
    if (r.status !== 1) { console.error(' REVERTED — stopping'); save(); process.exit(1); }

    const cost = r.gasUsed * r.gasPrice;
    totalGas += r.gasUsed; totalWei += cost;
    console.log(` ok  ${r.gasUsed} gas  ${formatEther(cost)} ETH`);

    for (const t of b) (job.kind === 'images' ? doneImg : doneTr).add(t);
    progress.spentWei = totalWei.toString();
    save();
    sent++;
  }
}

console.log(`\n${RUN ? 'sent' : 'simulated'} ${sent} txs   ${totalGas.toString()} gas`);
if (RUN) console.log(`spent ${formatEther(totalWei)} ETH total`);
else {
  for (const g of [0.03, 0.04, 0.05, 0.07, 0.09]) {
    console.log(`  @ ${g} gwei -> ${formatEther(totalGas * parseUnits(String(g), 'gwei'))} ETH for these ${sent} batches`);
  }
}
console.log(`progress: ${doneImg.size}/${ids.length} images, ${doneTr.size}/${ids.length} traits`);
