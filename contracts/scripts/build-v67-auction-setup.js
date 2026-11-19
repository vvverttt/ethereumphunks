/**
 * Build the Dysto-only pool setup for V67AuctionHouse and rehearse it on a mainnet fork.
 *
 *   node scripts/build-v67-auction-setup.js <owners.json> [forkRpc]
 *
 * owners.json = { block, owners: { [id]: address } } from scripts/_scan-v67-owners.js.
 * Pool = every v67 piece with Special = DystoPhunk (2,167). Writes paste-ready batches to
 * scripts/generated/v67_auction_setup/, then (if forkRpc is given, e.g. http://127.0.0.1:8547 from
 * `npx hardhat node --fork <rpc>`) replays every step as quantumphunks.eth on the fork and checks the result.
 * Nothing is broadcast to mainnet.
 */
const fs = require('fs'), path = require('path');
const { ethers } = require('ethers');

const QP = '0x19d57A31b982d3d75c16358795A4D19c803e4A72'; // quantumphunks.eth
const V67 = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';
const V66 = '0x988D066A0fad76a89DDc87bBF16e92E1187A477c'; // PhilipLotteryV66 proxy (holds 2,166 Dysto)
const AUCTION = '0xE3C8d1cf63456535Ad41E47932AF1Fe1708E84C2';
const WITHDRAW_BATCH = 300;
const DEPOSIT_BATCH = 250;

const V66_ABI = ['function withdrawItems(address to, uint256[] tokenIds)', 'function owner() view returns (address)'];
const V67_ABI = [
  'function setApprovedOperator(address operator, bool approved)',
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function ownerOf(uint256) view returns (address)',
  'function owner() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
];
const AUC_ABI = [
  'function deposit(uint256[] ids)',
  'function start()',
  'function poolSize() view returns (uint256)',
  'function currentAuction() view returns (address,uint256,uint256,address,uint256,uint256,bool,bool)',
  'function inPool(uint256) view returns (bool)',
];

const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

async function main() {
  const [ownersFile, forkRpc] = process.argv.slice(2);
  const { block, owners } = JSON.parse(fs.readFileSync(ownersFile, 'utf8'));
  const master = require(path.join(__dirname, '..', '..', 'QuantumPhunks_MASTER.json')).collection_items;
  const isDysto = (x) => x.attributes.some((a) => a.trait_type === 'Special' && a.value === 'DystoPhunk');
  const isTurtle = (x) => x.attributes.some((a) => a.trait_type === 'Animal' && a.value === 'Turtle');

  const dysto = master.filter(isDysto).map((x) => x.index).sort((a, b) => a - b);
  if (master.filter(isDysto).some(isTurtle)) throw new Error('a Dysto is also a turtle?');
  const inV66 = dysto.filter((id) => owners[id] === V66);
  const inQP = dysto.filter((id) => owners[id] === QP);
  const elsewhere = dysto.filter((id) => owners[id] !== V66 && owners[id] !== QP);
  console.log(`scan block ${block}: Dysto ${dysto.length} = V66 ${inV66.length} + quantumphunks.eth ${inQP.length} + elsewhere ${elsewhere.length}`);
  if (elsewhere.length) throw new Error(`Dysto held elsewhere: ${elsewhere.slice(0, 10)}`);

  const v66I = new ethers.Interface(V66_ABI), v67I = new ethers.Interface(V67_ABI), aucI = new ethers.Interface(AUC_ABI);
  const steps = [];
  chunk(inV66, WITHDRAW_BATCH).forEach((ids, k, all) => steps.push({
    step: `1.${k + 1}`, title: `V66 lottery: withdrawItems to quantumphunks.eth (batch ${k + 1}/${all.length}, ${ids.length} pieces)`,
    to: V66, fn: 'withdrawItems(address,uint256[])', args: [QP, ids], data: v66I.encodeFunctionData('withdrawItems', [QP, ids]),
  }));
  steps.push({ step: '2', title: 'v67: whitelist the auction as an operator', to: V67, fn: 'setApprovedOperator(address,bool)', args: [AUCTION, true], data: v67I.encodeFunctionData('setApprovedOperator', [AUCTION, true]) });
  steps.push({ step: '3', title: 'v67: approve the auction to pull pieces', to: V67, fn: 'setApprovalForAll(address,bool)', args: [AUCTION, true], data: v67I.encodeFunctionData('setApprovalForAll', [AUCTION, true]) });
  chunk(dysto, DEPOSIT_BATCH).forEach((ids, k, all) => steps.push({
    step: `4.${k + 1}`, title: `Auction: deposit (batch ${k + 1}/${all.length}, ${ids.length} pieces)`,
    to: AUCTION, fn: 'deposit(uint256[])', args: [ids], data: aucI.encodeFunctionData('deposit', [ids]),
  }));
  steps.push({ step: '5', title: 'Auction: start (opens auction #1)', to: AUCTION, fn: 'start()', args: [], data: aucI.encodeFunctionData('start', []) });
  // Safe gas limit per step (measured on a fork + ~25% headroom), for wallets whose estimate fails on big batches.
  for (const s of steps) {
    const n = Array.isArray(s.args[s.args.length - 1]) ? s.args[s.args.length - 1].length : 0;
    s.gasLimit = s.fn.startsWith('withdrawItems') ? 250_000 + n * 20_000
      : s.fn.startsWith('deposit') ? 400_000 + n * 55_000
      : s.fn === 'start()' ? 300_000 : 120_000;
  }

  // ---------------------------------------------------------------- fork rehearsal
  if (forkRpc) {
    const p = new ethers.JsonRpcProvider(forkRpc);
    await p.send('hardhat_impersonateAccount', [QP]);
    await p.send('hardhat_setBalance', [QP, '0x56BC75E2D63100000']);
    const qp = new ethers.JsonRpcSigner(p, QP); // impersonated, so not in eth_accounts
    const v67 = new ethers.Contract(V67, V67_ABI, p), auc = new ethers.Contract(AUCTION, AUC_ABI, p);
    console.log(`fork: v67 owner ${await v67.owner()}, V66 owner ${await new ethers.Contract(V66, V66_ABI, p).owner()}`);
    let total = 0n;
    for (const s of steps) {
      const tx = await qp.sendTransaction({ to: s.to, data: s.data, gasLimit: s.gasLimit });
      const r = await tx.wait();
      s.gasUsed = r.gasUsed.toString();
      total += r.gasUsed;
      console.log(`  ${s.step.padEnd(4)} ${r.status === 1 ? 'OK  ' : 'FAIL'} ${String(r.gasUsed).padStart(9)} gas  ${s.title}`);
      if (r.status !== 1) throw new Error('step failed');
    }
    const ca = await auc.currentAuction();
    const live = Number(ca[1]);
    const checks = [
      ['pool size (waiting)', await auc.poolSize(), 2166n],
      ['auction live', ca[6], false],
      ['live piece is Dysto', dysto.includes(live), true],
      ['live piece in pool', await auc.inPool(live), true],
      ['auction holds all 2,167', await v67.balanceOf(AUCTION), 2167n],
    ];
    for (const [k, got, want] of checks) console.log(`  ${got === want ? 'OK  ' : 'FAIL'} ${k}: ${got}`);
    console.log(`  total gas ${total} (~${ethers.formatEther(total * 100_000_000n)} ETH at 0.1 gwei, ~${ethers.formatEther(total * 300_000_000n)} at 0.3)`);
    if (checks.some(([, g, w]) => g !== w)) throw new Error('rehearsal check failed');
  }

  // ---------------------------------------------------------------- write files
  const out = path.join(__dirname, 'generated', 'v67_auction_setup');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'pool_dysto_ids.json'), JSON.stringify(dysto));
  fs.writeFileSync(path.join(out, 'steps.json'), JSON.stringify({ scanBlock: block, from: QP, steps }, null, 2));
  let md = `# V67 Auction setup: Dysto-only pool (${dysto.length} pieces)\n\nSend every step from quantumphunks.eth (${QP}), in order. Scan block ${block}.\n` +
    `For each step: open the "to" contract on Etherscan -> Write (as Proxy) -> the function -> paste the args. ` +
    `Or paste "to" + "data" into a raw transaction / Safe transaction builder.\n\n`;
  for (const s of steps) {
    md += `## Step ${s.step}: ${s.title}\n\nto: \`${s.to}\`  \nfunction: \`${s.fn}\`${s.gasUsed ? `  \nfork gas: ${s.gasUsed}` : ''}\n\n`;
    if (s.args.length) md += s.args.map((a, i) => `arg ${i + 1}:\n\n\`\`\`\n${Array.isArray(a) ? `[${a.join(',')}]` : a}\n\`\`\`\n`).join('\n') + '\n';
    md += `data:\n\n\`\`\`\n${s.data}\n\`\`\`\n\n`;
  }
  fs.writeFileSync(path.join(out, 'SETUP_STEPS.md'), md);
  console.log(`wrote ${out}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
