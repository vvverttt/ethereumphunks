// Storage-compatibility check for the market fix. The change is arithmetic only —
// no new state, nothing reordered — but validateUpgrade is what proves that.
import { ethers, upgrades } from 'hardhat';

async function main() {
  const Old = await ethers.getContractFactory('QuantumPhunksMarketMulti');
  const New = await ethers.getContractFactory('QuantumPhunksMarketMultiV2');
  await upgrades.validateUpgrade(Old, New, { kind: 'uups' });
  console.log('  [OK] storage layout compatible: QuantumPhunksMarketMulti -> QuantumPhunksMarketMultiV2');
  const bc = (await New.getDeployTransaction()).data as string;
  console.log(`  new implementation: ${(bc.length - 2) / 2} bytes of init code`);
}
main().catch((e) => { console.error(e); process.exit(1); });
