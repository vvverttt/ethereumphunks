import hre, { upgrades } from 'hardhat';

const proxyAddress = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading EtherPhunksAuctionHouseV2 — Audit fixes');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log('  Changes: nonReentrant withdrawFromPool, emergency pool cleanup, min bounds');
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory('EtherPhunksAuctionHouseV2');

  console.log('Upgrading implementation...');
  const upgraded = await upgrades.upgradeProxy(proxyAddress, ContractFactory, {
    unsafeSkipStorageCheck: true,
  });
  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Proxy (unchanged):     ${proxyAddress}`);
  console.log(`  New Implementation:    ${implAddress}`);
  console.log(`=====================================================================`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${implAddress}`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
