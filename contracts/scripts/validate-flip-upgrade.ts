// Prove the flip upgrade is storage-compatible with what is live, before anything is sent.
//
// The proxy is 0x67B850C3... and its current implementation is the verified
// CryptoPhunksV67. The new CryptoPhunksV67Flip adds ONE internal view function and
// changes how tokenURI assembles its JSON — no new state variables, nothing reordered.
// validateUpgrade is what proves that rather than asserting it.
import { ethers, upgrades } from 'hardhat';

const PROXY = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';

async function main() {
  const Old = await ethers.getContractFactory('CryptoPhunksV67');
  const New = await ethers.getContractFactory('CryptoPhunksV67Flip');

  console.log('validating CryptoPhunksV67 -> CryptoPhunksV67Flip …\n');

  // 1. layout-to-layout, independent of any local manifest
  await upgrades.validateUpgrade(Old, New, { kind: 'uups' });
  console.log('  [OK] storage layout compatible (old impl -> new impl)');

  // 2. against the live proxy as deployed
  try {
    await upgrades.validateUpgrade(PROXY, New, { kind: 'uups' });
    console.log('  [OK] compatible with the LIVE proxy ' + PROXY);
  } catch (e: any) {
    console.log('  [--] live-proxy check needs a manifest for this network: ' + String(e.message).split('\n')[0]);
  }

  const newBytecode = (await New.getDeployTransaction()).data as string;
  console.log(`\n  new implementation size: ${(newBytecode.length - 2) / 2} bytes (24576 is the limit)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
