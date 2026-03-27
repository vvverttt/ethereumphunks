import hre, { upgrades } from 'hardhat';

const proxyAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading EthsRocks — Remove Chainlink, BASE_PRICE = 0.0017 ETH');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log('  Changes: remove oracle pricing, fixed 0.0017 ETH increments');
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory('EthsRocksV2');

  console.log('Upgrading implementation...');
  const upgraded = await upgrades.upgradeProxy(proxyAddress, ContractFactory, {
    unsafeSkipStorageCheck: true,
  });
  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  // Verify new price
  const contract = await hre.ethers.getContractAt('EthsRocksV2', proxyAddress);
  const price = await contract.currentPrice();
  const basePrice = await contract.BASE_PRICE();

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Proxy (unchanged):     ${proxyAddress}`);
  console.log(`  New Implementation:    ${implAddress}`);
  console.log(`  BASE_PRICE:            ${hre.ethers.formatEther(basePrice)} ETH`);
  console.log(`  Current Price:         ${hre.ethers.formatEther(price)} ETH`);
  console.log(`=====================================================================`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${implAddress}`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
