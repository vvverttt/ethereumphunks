import { ethers, upgrades } from 'hardhat';
async function main() {
  const Old = await ethers.getContractFactory('EtherPhunksAuctionHouseV5');
  const New = await ethers.getContractFactory('EtherPhunksAuctionHouseV6');
  await upgrades.validateUpgrade(Old, New, { kind: 'transparent' });
  console.log('  [OK] storage compatible V5 -> V6 (totalPendingReturns from V2 __gap 43 -> 42)');
  const bc = (await New.getDeployTransaction()).data as string;
  console.log(`  init code ${(bc.length - 2) / 2} bytes`);
}
main().catch((e) => { console.error(String(e).split('\n').slice(0, 12).join('\n')); process.exit(1); });
