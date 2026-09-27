import { ethers, upgrades } from 'hardhat';
async function main() {
  const Old = await ethers.getContractFactory('contracts/PhilipLotteryV67_CarlRouting.sol:PhilipLotteryV67Erc721');
  const New = await ethers.getContractFactory('contracts/PhilipLotteryV67_WlRefundFix.sol:PhilipLotteryV67Erc721WlFix');
  await upgrades.validateUpgrade(Old, New, { kind: 'uups' });
  console.log('  [OK] storage layout compatible (new mapping consumes __gap: 35 -> 34)');
  const bc = (await New.getDeployTransaction()).data as string;
  console.log(`  init code ${(bc.length - 2) / 2} bytes`);
}
main().catch((e) => { console.error(e); process.exit(1); });
