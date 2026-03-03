import hre, { upgrades } from 'hardhat';

const proxyAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading EthsRocks — Audit fixes');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log('  Changes: bind tokenIds in sig, blockhash check, nonReentrant withdrawFromPool');
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory('EthsRocks');

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
