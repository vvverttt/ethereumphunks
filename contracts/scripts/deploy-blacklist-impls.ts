// STEP 1 of the blacklist/recovery rollout.
// Deploys the two NEW implementations only (no proxy interaction) — so it can be
// run by the funded env deployer (0x77ED6E…); it does NOT need to be the owner.
//
//   npx hardhat run scripts/deploy-blacklist-impls.ts --network mainnet
//
// STEP 2 (must be signed by quantumphunks.eth = ProxyAdmin owner, via Frame/Etherscan):
//   Auction    ProxyAdmin 0xd043f41F07e7Bc140e51971f7dd3C33AB35508AD
//     .upgradeAndCall(0xc1fA86b53e8e101c93c570f276bC5177832bd031, <AUCTION_IMPL>, 0x)
//   LotteryStd ProxyAdmin 0x426335fa9f974Ffb0c5Dc11313dc4cb4dd615E7d
//     .upgradeAndCall(0x29b0d38112e8e743b63EB463F3351ab0F1E15977, <LOTTERY_IMPL>, 0x)
//   LotteryPrm ProxyAdmin 0x29c9Cf618A057A2AF7885f03E0F211Bf07c4D885
//     .upgradeAndCall(0x298771ECc338DE242ADa11e49E2B8224c33bf620, <LOTTERY_IMPL>, 0x)
//   (both lottery proxies upgrade to the SAME LOTTERY_IMPL)
//
// STEP 3 (as quantumphunks.eth, owner of the logic contracts):
//   - setBlacklist(0xea04f65f9dc5917302532859d80fcf36a15de266, true) on all three
//   - auction: adminWithdraw(DystoLabz, [44 hashIds], quantumphunks.eth)
//   - lotteries: withdrawPrizeBatch([hashIds]) in chunks of ~150-250

import hre from 'hardhat';
const { ethers } = hre as any;

async function main() {
  const [s] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(s.address);
  console.log('Deployer:', s.address, ' balance:', ethers.formatEther(bal), 'ETH');

  console.log('\nDeploying AUCTION impl (EtherPhunksAuctionHouseV2)...');
  const Auc = await ethers.getContractFactory('EtherPhunksAuctionHouseV2');
  const auc = await Auc.deploy();
  await auc.waitForDeployment();
  const aucImpl = await auc.getAddress();
  console.log('  AUCTION_IMPL =', aucImpl);

  console.log('\nDeploying LOTTERY impl (PhilipLotteryV67_VRF)...');
  const Lot = await ethers.getContractFactory('PhilipLotteryV67_VRF');
  const lot = await Lot.deploy();
  await lot.waitForDeployment();
  const lotImpl = await lot.getAddress();
  console.log('  LOTTERY_IMPL =', lotImpl);

  console.log('\n=== STEP 2: upgrade as quantumphunks.eth (ProxyAdmin owner) ===');
  console.log(`Auction    : ProxyAdmin 0xd043f41F07e7Bc140e51971f7dd3C33AB35508AD .upgradeAndCall(0xc1fA86b53e8e101c93c570f276bC5177832bd031, ${aucImpl}, 0x)`);
  console.log(`LotteryStd : ProxyAdmin 0x426335fa9f974Ffb0c5Dc11313dc4cb4dd615E7d .upgradeAndCall(0x29b0d38112e8e743b63EB463F3351ab0F1E15977, ${lotImpl}, 0x)`);
  console.log(`LotteryPrm : ProxyAdmin 0x29c9Cf618A057A2AF7885f03E0F211Bf07c4D885 .upgradeAndCall(0x298771ECc338DE242ADa11e49E2B8224c33bf620, ${lotImpl}, 0x)`);
  console.log('\nVerify impls:');
  console.log(`  npx hardhat verify --network mainnet ${aucImpl}`);
  console.log(`  npx hardhat verify --network mainnet ${lotImpl}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
