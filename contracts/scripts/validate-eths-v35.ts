import { ethers, upgrades } from 'hardhat';
async function main() {
  const Old = await ethers.getContractFactory('EtherPhunksMarketV3_4');
  const New = await ethers.getContractFactory('EtherPhunksMarketV3_5');
  await upgrades.validateUpgrade(Old, New, { kind: 'transparent' });
  console.log('  [OK] storage layout compatible: V3_4 -> V3_5');
  const bc = (await New.getDeployTransaction()).data as string;
  console.log(`  init code ${(bc.length - 2) / 2} bytes`);
}
main().catch((e) => { console.error(e); process.exit(1); });
