import hre from 'hardhat';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Deploying Points V2 (fixed transferPoints, pause/unpause, renounceRole guard)');
  console.log(`  Signer: ${signer.address}`);
  console.log('=====================================================================');

  const PointsFactory = await hre.ethers.getContractFactory('Points');
  const points = await PointsFactory.deploy();
  await points.waitForDeployment();

  const pointsAddress = await points.getAddress();

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Points V2 deployed at: ${pointsAddress}`);
  console.log(`=====================================================================`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${pointsAddress}`);
  console.log(`\nNOTE: After deploying, you must:`);
  console.log(`  1. Grant POINTS_MANAGER_ROLE to all contracts (MarketV3, AuctionHouseV2, EthsRocks, Lottery proxies)`);
  console.log(`  2. Update pointsAddress on each contract`);
  console.log(`  3. Update frontend/indexer env configs with new Points address`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
