// End-to-end proof: deploy the flip implementation locally, load the REAL on-chain art for
// QuantumPhunk #4 and the animated #5329, and read tokenURI back out of the contract.
// Nothing is simulated in JS — the HTML below is what the contract itself returns.
import { ethers, upgrades } from 'hardhat';
import * as fs from 'fs';

const MAINNET = 'https://ethereum-rpc.publicnode.com';
const V67 = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';

async function main() {
  const live = new ethers.JsonRpcProvider(MAINNET, 1, { staticNetwork: true });
  const src = new ethers.Contract(V67, ['function tokenImage(uint256) view returns (string)'], live);
  const art4 = await src.tokenImage(4);
  const art5329 = await src.tokenImage(5329);

  const [me] = await ethers.getSigners();
  const F = await ethers.getContractFactory('CryptoPhunksV67Flip');
  const c: any = await upgrades.deployProxy(F, ['CryptoPhunksV67', 'QPHUNK', me.address, me.address], { kind: 'uups' });
  await c.waitForDeployment();

  await (await c.setBackgroundColor('67cdff')).wait();
  await (await c.setTokenImageBatch([4, 5329], [art4, art5329])).wait();
  await (await c.batchSetTraits([4], [['Type', 'Animal']], [['Male', 'Penguin']])).wait();
  await (await c.setAnimated([5329], true)).wait();
  await (await c.ownerMintBatch(me.address, [4, 5329])).wait();

  const out: string[] = [];
  for (const id of [4, 5329]) {
    const uri: string = await c.tokenURI(id);
    const j = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());
    const anim = j.animation_url as string;
    const html = Buffer.from(anim.split(',')[1], 'base64').toString();
    console.log(`#${id}  name="${j.name}"`);
    console.log(`     image        ${j.image.length} chars (static SVG, left-facing)`);
    console.log(`     animation_url ${anim.length} chars -> ${html.length} chars of HTML`);
    console.log(`     has flip handler: ${html.includes('classList.toggle') ? 'YES' : 'NO'}`);
    out.push(`<h3 style="font:14px monospace;color:#7b96a6">#${id} — straight from the contract's tokenURI</h3>
      <iframe style="width:340px;height:340px;border:1px solid #1f3340" srcdoc='${html.replace(/'/g, "&#39;")}'></iframe>`);
  }

  fs.writeFileSync('../flip-from-contract.html',
    `<body style="margin:0;background:#0c141a;color:#e6f1f7;font:14px monospace;padding:24px">
     <h2>click each phunk — output of CryptoPhunksV67Flip.tokenURI()</h2>
     <div style="display:flex;gap:30px">${out.join('')}</div></body>`);
  console.log('\nwrote flip-from-contract.html');
}

main().catch((e) => { console.error(e); process.exit(1); });
