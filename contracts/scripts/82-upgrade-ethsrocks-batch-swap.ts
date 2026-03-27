import hre, { upgrades } from 'hardhat';

const proxyAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading EthsRocks — Add batch ethscription swap (EtherPhunks)');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log('=====================================================================');

  console.log('\n1. Upgrading implementation...');
  const ContractFactory = await hre.ethers.getContractFactory('EthsRocksV2');
  const upgraded = await upgrades.upgradeProxy(proxyAddress, ContractFactory, {
    unsafeSkipStorageCheck: true,
  });
  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`   New implementation: ${implAddress}`);

  const contract = await hre.ethers.getContractAt('EthsRocksV2', proxyAddress);

  // Verify batch required defaults
  const batchRequired = await contract.ethscriptionBatchRequired();
  console.log(`\n2. Batch required: ${batchRequired} (0 means default 5)`);

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Proxy (unchanged):     ${proxyAddress}`);
  console.log(`  New Implementation:    ${implAddress}`);
  console.log(`  Next: load 10k EtherPhunks hashIds via setEligibleEthscriptionBatchSwap`);
  console.log(`=====================================================================`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${implAddress}`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
