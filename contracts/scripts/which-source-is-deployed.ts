/**
 * For every live contract, find WHICH SOURCE FILE the deployed bytecode actually is.
 *
 * Read-only. Written after discovering the NFT audit had been done against
 * QuantumPhunksNFT.sol while QuantumPhunksNFTFlip.sol was what was deployed — a mistake that
 * produces tests which pass, prove nothing, and look like coverage.
 *
 * Rather than assume a name, this compares the deployed runtime against EVERY compiled
 * artifact and reports the one that matches. Two differences are treated as expected:
 *
 *   - immutables: a UUPS `__self` holds the implementation's own address, which is zeros in
 *     the artifact. Compared with those regions masked out.
 *   - metadata: the trailing CBOR blob encodes source paths and compiler settings, so it
 *     differs between an equivalent local build and the deployed one. Compared without it.
 *
 * A match on the code before the metadata, with only immutable-sized gaps, is the strongest
 * statement available short of a full verified build.
 *
 *   npx hardhat run scripts/which-source-is-deployed.ts --network mainnet
 */
import hre from 'hardhat';

const EIP1967 = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

const LIVE: Record<string, string> = {
  'NFT (v67)':      '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3',
  'QP market':      '0xe977EaD9f08cC450FBb54B8f80D2E92b27714b44',
  'eths market':    '0xa48a43186612B179C0bc68Ea34B4932549a70BfA',
  'lottery':        '0x702862d4cb2E55452170814AAb9117cDE8287e61',
  'auction house':  '0xc1fA86b53e8e101c93c570f276bC5177832bd031',
};

/** Strip the trailing CBOR metadata blob, whose last two bytes give its length. */
function stripMeta(hex: string): string {
  const h = hex.toLowerCase().replace(/^0x/, '');
  if (h.length < 4) return h;
  const len = parseInt(h.slice(-4), 16);
  if (!Number.isFinite(len) || len * 2 + 4 > h.length) return h;
  return h.slice(0, h.length - 4 - len * 2);
}

/** Byte positions where two equal-length hex strings differ, grouped into runs. */
function diffRuns(a: string, b: string): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  for (let i = 0; i < a.length; i += 2) {
    if (a.slice(i, i + 2) !== b.slice(i, i + 2)) {
      const byte = i / 2;
      if (runs.length && byte - runs[runs.length - 1][1] <= 1) runs[runs.length - 1][1] = byte;
      else runs.push([byte, byte]);
    }
  }
  return runs;
}

async function main() {
  const { ethers, artifacts } = hre as any;
  const names: string[] = await artifacts.getAllFullyQualifiedNames();
  console.log(`comparing against ${names.length} compiled artifacts\n`);

  // Cache every artifact's metadata-stripped runtime, keyed by length for a fast first pass.
  const byLen = new Map<number, Array<{ name: string; code: string }>>();
  for (const n of names) {
    try {
      const a = await artifacts.readArtifact(n);
      const dep: string = a.deployedBytecode;
      if (!dep || dep === '0x') continue;
      const code = stripMeta(dep);
      if (!code.length) continue;
      const arr = byLen.get(code.length) ?? [];
      arr.push({ name: n, code });
      byLen.set(code.length, arr);
    } catch { /* unreadable artifact */ }
  }

  for (const [label, proxy] of Object.entries(LIVE)) {
    const slot = await ethers.provider.getStorage(proxy, EIP1967);
    const impl = '0x' + slot.slice(26);
    const isProxy = impl !== '0x' + '0'.repeat(40);
    const target = isProxy ? impl : proxy;

    const live = stripMeta(await ethers.provider.getCode(target));
    console.log(`${label}`);
    console.log(`  proxy ${proxy}`);
    console.log(`  impl  ${isProxy ? impl : '(not a proxy — code is at the address itself)'}`);
    console.log(`  size  ${live.length / 2} bytes (metadata stripped)`);

    const candidates = byLen.get(live.length) ?? [];
    let best: { name: string; runs: Array<[number, number]> } | null = null;
    for (const c of candidates) {
      const runs = diffRuns(c.code, live);
      // An immutable is a 32-byte word holding a 20-byte address, so differing runs of <= 32
      // bytes are consistent with immutables and nothing else.
      const onlyImmutables = runs.every(([s, e]) => e - s + 1 <= 32);
      if (runs.length === 0) { best = { name: c.name, runs }; break; }
      if (onlyImmutables && (!best || runs.length < best.runs.length)) best = { name: c.name, runs };
    }

    if (!best) {
      console.log(`  [MISS] no artifact matches this size — the source is not in this repo,`);
      console.log(`         or was built with different compiler settings.`);
    } else if (best.runs.length === 0) {
      console.log(`  [EXACT] ${best.name}`);
    } else {
      console.log(`  [MATCH] ${best.name}`);
      console.log(`          ${best.runs.length} differing region(s), all <= 32 bytes — immutables:`);
      for (const [s, e] of best.runs.slice(0, 4)) console.log(`            bytes ${s}-${e} (${e - s + 1})`);
    }
    console.log('');
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
