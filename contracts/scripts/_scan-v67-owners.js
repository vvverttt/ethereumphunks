const { ethers } = require('ethers');
const p = new ethers.JsonRpcProvider('https://eth.drpc.org');
const V67 = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';
const MC = new ethers.Contract('0xcA11bde05977b3631167028862bE2a173976CA11', ['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[])'], p);
const I = new ethers.Interface(['function ownerOf(uint256) view returns (address)']);
(async () => {
  const block = await p.getBlockNumber();
  const out = {};
  for (let s = 1; s <= 10000; s += 500) {
    const calls = []; for (let i = s; i < s + 500 && i <= 10000; i++) calls.push({ target: V67, allowFailure: true, callData: I.encodeFunctionData('ownerOf', [i]) });
    for (let tries = 0; ; tries++) {
      try {
        const r = await MC.aggregate3(calls, { blockTag: block });
        r.forEach((x, k) => { out[s + k] = x.success ? I.decodeFunctionResult('ownerOf', x.returnData)[0] : '(none)'; });
        break;
      } catch (e) { if (tries > 4) throw e; await new Promise((r) => setTimeout(r, 2000)); }
    }
  }
  require('fs').writeFileSync(process.argv[2], JSON.stringify({ block, owners: out }));
  console.log('block', block, 'scanned', Object.keys(out).length);
})().catch((e) => { console.error(e.message); process.exit(1); });
