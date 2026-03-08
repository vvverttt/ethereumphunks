import hre, { upgrades } from 'hardhat';

const marketProxy = '0xa48a43186612B179C0bc68Ea34B4932549a70BfA';
const auctionProxy = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';
const evolveProxy = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';
const ethsRocksProxy = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading 4 contracts with audit fixes');
  console.log(`  Signer: ${signer.address}`);
  console.log('=====================================================================');

  // --- 1. Marketplace ---
  console.log('\n[1/4] Upgrading Marketplace (EtherPhunksMarketV3)...');
  const MarketFactory = await hre.ethers.getContractFactory('EtherPhunksMarketV3');
  const upgradedMarket = await upgrades.upgradeProxy(marketProxy, MarketFactory, {
    unsafeSkipStorageCheck: true,
  });
  await upgradedMarket.waitForDeployment();
  const implMarket = await upgrades.erc1967.getImplementationAddress(marketProxy);
  console.log(`  Market new impl: ${implMarket}`);

  // --- 2. Auction ---
  console.log('\n[2/4] Upgrading Auction (EtherPhunksAuctionHouseV2)...');
  const AuctionFactory = await hre.ethers.getContractFactory('EtherPhunksAuctionHouseV2');
  const upgradedAuction = await upgrades.upgradeProxy(auctionProxy, AuctionFactory, {
    unsafeSkipStorageCheck: true,
  });
  await upgradedAuction.waitForDeployment();
  const implAuction = await upgrades.erc1967.getImplementationAddress(auctionProxy);
  console.log(`  Auction new impl: ${implAuction}`);

  // --- 3. Evolve/Mutation ---
  console.log('\n[3/4] Upgrading Evolve (Mutation)...');
  const EvolveFactory = await hre.ethers.getContractFactory('Mutation');
  const upgradedEvolve = await upgrades.upgradeProxy(evolveProxy, EvolveFactory, {
    unsafeSkipStorageCheck: true,
  });
  await upgradedEvolve.waitForDeployment();
  const implEvolve = await upgrades.erc1967.getImplementationAddress(evolveProxy);
  console.log(`  Evolve new impl: ${implEvolve}`);

  // --- 4. EthsRocks ---
  console.log('\n[4/4] Upgrading EthsRocks...');
  const RocksFactory = await hre.ethers.getContractFactory('EthsRocks');
  const upgradedRocks = await upgrades.upgradeProxy(ethsRocksProxy, RocksFactory, {
    unsafeSkipStorageCheck: true,
  });
  await upgradedRocks.waitForDeployment();
  const implRocks = await upgrades.erc1967.getImplementationAddress(ethsRocksProxy);
  console.log(`  EthsRocks new impl: ${implRocks}`);

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Market:    ${marketProxy}  →  impl: ${implMarket}`);
  console.log(`  Auction:   ${auctionProxy}  →  impl: ${implAuction}`);
  console.log(`  Evolve:    ${evolveProxy}  →  impl: ${implEvolve}`);
  console.log(`  EthsRocks: ${ethsRocksProxy}  →  impl: ${implRocks}`);
  console.log(`=====================================================================`);
  console.log(`\nVerify:`);
  console.log(`  npx hardhat verify --network mainnet ${implMarket} --contract contracts/V2MainnetUpgrade/EtherPhunksMarketV3.sol:EtherPhunksMarketV3`);
  console.log(`  npx hardhat verify --network mainnet ${implAuction} --contract contracts/V2MainnetUpgrade/EtherPhunksAuctionHouseV2.sol:EtherPhunksAuctionHouseV2`);
  console.log(`  npx hardhat verify --network mainnet ${implEvolve} --contract contracts/V2MainnetUpgrade/EtherPhunksEvolve.sol:Mutation`);
  console.log(`  npx hardhat verify --network mainnet ${implRocks} --contract contracts/V2MainnetUpgrade/EthsRocks.sol:EthsRocks`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
