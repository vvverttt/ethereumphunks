import hre, { upgrades } from 'hardhat';

const proxyAddress = '0xa48a43186612B179C0bc68Ea34B4932549a70BfA';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading EtherPhunksMarketV3 — Audit fixes');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log('  Changes: _disableInitializers, pull royalty, revert receive, whenNotPaused listings');
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory('EtherPhunksMarketV3');

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
