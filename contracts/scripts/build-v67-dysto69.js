/**
 * Overwrite 69 live v67 tokens with the OG 69 DystoPhunkz art + traits (images + traits only, no mint,
 * no transfer: all 69 sit in the auction pool and keep their owner). Owner setters, sent by quantumphunks.eth.
 *   node scripts/build-v67-dysto69.js            -> payload + backup + paste files (reads mainnet, free RPC)
 *   node scripts/build-v67-dysto69.js <forkRpc>  -> also rehearses every tx on a fork and reads back
 * Attribute Count is appended LAST (stored trait; value = entry count without itself), like every live token.
 */
const fs = require('fs'), path = require('path');
const { ethers } = require('ethers');
const SRC = process.env.SRC || 'c:/Users/alber/OneDrive/Desktop/New folder (12)/yolo/quantumdystophunkzv67-tinted';
const OUT = path.join(__dirname, '..', '..', 'v67_dysto69');
const V67 = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3', QP = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';
const IMG_BATCH = Number(process.env.IMG_BATCH || 35), TR_BATCH = Number(process.env.TR_BATCH || 23), CAP = 16_777_216n;
const ABI = ['function setTokenImageBatch(uint256[] t, string[] v)', 'function batchSetTraits(uint256[] t, string[][] keys, string[][] vals)',
  'function tokenURI(uint256) view returns (string)', 'function ownerOf(uint256) view returns (address)', 'function owner() view returns (address)'];
const iface = new ethers.Interface(ABI);
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const meta = (uri) => JSON.parse(Buffer.from(uri.slice(uri.indexOf('base64,') + 7), 'base64').toString());
const pngOf = (svgUri) => {
  const svg = Buffer.from(svgUri.split('base64,')[1], 'base64').toString();
  const m = svg.match(/href="(data:image\/png;base64,[^"]+)"/);
  return m && m[1];
};
const retry = async (f) => {
  for (let k = 0; ; k++) {
    try { return await f(); } catch (e) { if (k > 5) throw e; await new Promise((r) => setTimeout(r, 1500)); }
  }
};

(async () => {
  const tok = JSON.parse(fs.readFileSync(path.join(SRC, 'quantumdystophunkz-69.json'), 'utf8')).tokens;
  const st = JSON.parse(fs.readFileSync(path.join(SRC, 'erc721_quantumdystophunkz_69_setTraits.json'), 'utf8'));
  if (tok.length !== 69) throw new Error('expected 69 tokens');
  const ids = tok.map((t) => t.tokenId).sort((a, b) => a - b);
  const uris = {}, traits = {};
  for (const t of tok) {
    const s = st[t.tokenId];
    if (JSON.stringify(s.keys) !== JSON.stringify(t.attributes.map((a) => a.trait_type))) throw new Error('setTraits != tokens json at ' + t.tokenId);
    if (s.keys.includes('Attribute Count')) throw new Error('already has Attribute Count: ' + t.tokenId);
    traits[t.tokenId] = { keys: [...s.keys, 'Attribute Count'], vals: [...s.vals.map(String), String(s.keys.length)] };
    const png = fs.readFileSync(path.join(SRC, t.image));
    if (png.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a PNG: ' + t.image);
    uris[t.tokenId] = 'data:image/png;base64,' + png.toString('base64');
  }

  // backup of what is on-chain now (restorable with the same two setters)
  const main = new ethers.JsonRpcProvider('https://eth.drpc.org', 1, { staticNetwork: true, batchMaxCount: 1 });
  const live = new ethers.Contract(V67, ABI, main);
  if ((await live.owner()) !== QP) throw new Error('v67 owner is not quantumphunks.eth');
  const bUris = {}, bTraits = {};
  for (const id of ids) {
    const j = meta(await retry(() => live.tokenURI(id)));
    bUris[id] = pngOf(j.image);
    bTraits[id] = { keys: j.attributes.map((a) => a.trait_type), vals: j.attributes.map((a) => String(a.value)) };
    if (!bUris[id]) throw new Error('could not extract current png for ' + id);
  }
  fs.mkdirSync(path.join(OUT, 'backup'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'backup', 'dataURIs.json'), JSON.stringify(bUris, null, 2));
  fs.writeFileSync(path.join(OUT, 'backup', 'setTraits.json'), JSON.stringify(bTraits, null, 2));
  fs.writeFileSync(path.join(OUT, 'dataURIs.json'), JSON.stringify(uris, null, 2));
  fs.writeFileSync(path.join(OUT, 'setTraits.json'), JSON.stringify(traits, null, 2));

  const steps = [];
  chunk(ids, IMG_BATCH).forEach((b, i, all) => steps.push({
    n: `1.${i + 1}`, label: `v67: setTokenImageBatch (${i + 1}/${all.length}, ${b.length} images)`, fn: 'setTokenImageBatch', ids: b,
    data: iface.encodeFunctionData('setTokenImageBatch', [b, b.map((t) => uris[t])]),
    boxes: [JSON.stringify(b), JSON.stringify(b.map((t) => uris[t]))],
  }));
  chunk(ids, TR_BATCH).forEach((b, i, all) => steps.push({
    n: `2.${i + 1}`, label: `v67: batchSetTraits (${i + 1}/${all.length}, ${b.length} tokens)`, fn: 'batchSetTraits', ids: b,
    data: iface.encodeFunctionData('batchSetTraits', [b, b.map((t) => traits[t].keys), b.map((t) => traits[t].vals)]),
    boxes: [JSON.stringify(b), JSON.stringify(b.map((t) => traits[t].keys)), JSON.stringify(b.map((t) => traits[t].vals))],
  }));

  const fork = process.argv[2];
  if (fork) {
    const fp = new ethers.JsonRpcProvider(fork, undefined, { batchMaxCount: 1 });
    await fp.send('hardhat_impersonateAccount', [QP]);
    await fp.send('hardhat_setBalance', [QP, '0x56BC75E2D63100000']);
    const signer = new ethers.JsonRpcSigner(fp, QP);
    const fc = new ethers.Contract(V67, ABI, fp);
    const owners0 = [];
    for (const id of ids) owners0.push(await fc.ownerOf(id));
    let total = 0n;
    for (const s of steps) {
      const r = await (await signer.sendTransaction({ to: V67, data: s.data, gasLimit: CAP })).wait();
      if (r.status !== 1) throw new Error('reverted ' + s.n);
      const lim = (r.gasUsed * 125n) / 100n;
      s.gasUsed = Number(r.gasUsed); s.gasLimit = Number(lim > CAP ? CAP : lim); total += r.gasUsed;
      console.log(`  ${s.n}  ${s.label}  gas ${r.gasUsed}`);
    }
    let bad = 0;
    for (const id of ids) {
      const j = meta(await fc.tokenURI(id));
      const k = j.attributes.map((a) => a.trait_type), v = j.attributes.map((a) => String(a.value));
      if (pngOf(j.image) !== uris[id] || JSON.stringify(k) !== JSON.stringify(traits[id].keys)
        || JSON.stringify(v) !== JSON.stringify(traits[id].vals) || j.name !== `QuantumPhunk #${id}`) { bad++; console.log('  MISMATCH', id); }
    }
    const owners1 = [];
    for (const id of ids) owners1.push(await fc.ownerOf(id));
    console.log(`fork: read-back mismatches ${bad}/69, owners unchanged ${JSON.stringify(owners0) === JSON.stringify(owners1)}, total gas ${total}`);
    for (const g of [0.1, 0.128, 0.2]) console.log(`  @${g} gwei: ${ethers.formatEther(total * ethers.parseUnits(String(g), 'gwei'))} ETH`);
  }

  fs.mkdirSync(path.join(OUT, 'paste'), { recursive: true });
  let md = `# v67: overwrite 69 tokens with the OG 69 DystoPhunkz (images + traits)\n\nSend every step from quantumphunks.eth. Etherscan -> ${V67} -> Write as Proxy -> the function. Images first, then traits.\nAll 69 are in the auction pool; owners do not change. Backup of the current state: v67_dysto69/backup/.\n\n`;
  for (const s of steps) {
    md += `## Step ${s.n}: ${s.label}\n\nfunction: \`${s.fn}\`  \nids: ${s.ids.join(', ')}  \n${s.gasLimit ? `gas limit: ${s.gasLimit}  \nused on the fork: ${s.gasUsed}\n` : ''}\n`;
    const names = s.fn === 'setTokenImageBatch' ? ['t (uint256[])', 'v (string[])'] : ['t (uint256[])', 'keys (string[][])', 'vals (string[][])'];
    fs.writeFileSync(path.join(OUT, 'paste', `step_${s.n}.txt`), s.boxes.map((b, i) => `box ${i + 1}, ${names[i]}:\n${b}\n`).join('\n'));
    fs.writeFileSync(path.join(OUT, 'paste', `step_${s.n}.data.txt`), `to: ${V67}\ndata:\n${s.data}\n`);
  }
  fs.writeFileSync(path.join(OUT, 'STEPS.md'), md);
  fs.writeFileSync(path.join(OUT, 'steps.json'), JSON.stringify(steps.map(({ boxes, ...s }) => s), null, 2));
  console.log('wrote', OUT, steps.map((s) => s.n).join(' '));
})().catch((e) => { console.error(e); process.exit(1); });
