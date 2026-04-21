import hre, { upgrades } from 'hardhat';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  // Same params as original auction house
  const treasuryAddress = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';
  const pointsAddress = '0xA22a3E40C3C5A01F802c5698Af6Ed5fAA21095eb';
  const duration = 280800; // ~3.25 days (same as original)
  const reservePrice = 0; // no reserve (set per-item later)
  const timeBuffer = 600; // 10 minutes
  const minBidIncrementPercentage = 10;

  console.log('\n=====================================================================');
  console.log('Deploying EtherPhunksAuctionHouseV2 #2 (Upgradeable Proxy)');
  console.log(`  Signer:   ${signer.address}`);
  console.log(`  Treasury: ${treasuryAddress}`);
  console.log('=====================================================================');

  const Factory = await hre.ethers.getContractFactory('EtherPhunksAuctionHouseV2');

  const proxy = await upgrades.deployProxy(Factory, [
    duration,
    timeBuffer,
    minBidIncrementPercentage,
    reservePrice,
    pointsAddress,
    treasuryAddress,
  ], {
    initializer: 'initialize',
    kind: 'transparent',
  });
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Proxy:          ${proxyAddress}`);
  console.log(`  Implementation: ${implAddress}`);
  console.log(`  Proxy Admin:    ${adminAddress}`);
  console.log(`=====================================================================`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${implAddress}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Transfer ownership to ${treasuryAddress}`);
  console.log(`  2. Transfer proxy admin to ${treasuryAddress}`);
  console.log(`  3. Set reserve price if different from 0.01 ETH`);
  console.log(`  4. Deposit v67 items`);
  console.log(`  5. Start first auction`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
