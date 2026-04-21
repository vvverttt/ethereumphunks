import hre, { upgrades } from 'hardhat';

const proxyAddress = '0xB69d359Eaf0db03372a587d9dB6f75B0A92CB218';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading CryptoPhunksVault — User picks swap item');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log('=====================================================================');

  const Factory = await hre.ethers.getContractFactory('CryptoPhunksVault');

  console.log('\nUpgrading implementation...');
  const upgraded = await upgrades.upgradeProxy(proxyAddress, Factory, {
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

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
