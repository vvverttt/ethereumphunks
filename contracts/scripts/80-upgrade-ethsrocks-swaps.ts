import hre, { upgrades } from 'hardhat';

const proxyAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading EthsRocks — Add swap functions, disable old commit/reveal');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log('=====================================================================');

  // Step 1: Upgrade contract
  console.log('\n1. Upgrading implementation...');
  const ContractFactory = await hre.ethers.getContractFactory('EthsRocksV2');
  const upgraded = await upgrades.upgradeProxy(proxyAddress, ContractFactory, {
    unsafeSkipStorageCheck: true,
  });
  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`   New implementation: ${implAddress}`);

  const contract = await hre.ethers.getContractAt('EthsRocksV2', proxyAddress);

  // Step 2: Verify addresses already set from V1
  const philipIntern = await contract.philipInternAddress();
  const cryptoPhunksV2 = await contract.cryptoPhunksV2Address();
  const treasury = await contract.treasuryAddress();
  console.log(`\n2. Verifying stored addresses:`);
  console.log(`   PhilipIntern:   ${philipIntern}`);
  console.log(`   CryptoPhunksV2: ${cryptoPhunksV2}`);
  console.log(`   Treasury:       ${treasury}`);

  // Step 3: Set correct addresses if needed
  const PHILIP_INTERN = '0xa82f3a61f002f83eba7d184c50bb2a8b359ca1ce';
  const CRYPTO_PHUNKS_V2 = '0xf07468ead8cf26c752c676e43c814fee9c8cf402';

  if (philipIntern.toLowerCase() !== PHILIP_INTERN) {
    console.log('\n   Setting PhilipIntern address...');
    const tx = await contract.setPhilipInternAddress(PHILIP_INTERN);
    await tx.wait();
    console.log(`   Set to: ${PHILIP_INTERN}`);
  }

  if (cryptoPhunksV2.toLowerCase() !== CRYPTO_PHUNKS_V2) {
    console.log('\n   Setting CryptoPhunksV2 address...');
    const tx = await contract.setCryptoPhunksV2Address(CRYPTO_PHUNKS_V2);
    await tx.wait();
    console.log(`   Set to: ${CRYPTO_PHUNKS_V2}`);
  }

  // Step 4: Verify disabled functions
  console.log('\n3. Verifying commit/reveal/freeClaim are disabled...');
  try {
    await contract.commit.staticCall(0, { value: 0 });
    console.log('   WARNING: commit did not revert!');
  } catch (e: any) {
    console.log(`   commit: reverts with "${e.reason || 'Disabled'}"`);
  }

  // Step 5: Check swap state
  const swapEnabled = await contract.swapEnabled();
  const poolSize = await contract.poolSize();
  console.log(`\n4. Current state:`);
  console.log(`   Swap enabled: ${swapEnabled}`);
  console.log(`   Pool size:    ${poolSize}`);

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Proxy (unchanged):     ${proxyAddress}`);
  console.log(`  New Implementation:    ${implAddress}`);
  console.log(`  Swap enabled:          ${swapEnabled} (call setSwapEnabled(true) when ready)`);
  console.log(`  Pool size:             ${poolSize} (deposit rocks before enabling swaps)`);
  console.log(`  Next: load eligible ethscription hashIds via setEligibleEthscriptionsBatch`);
  console.log(`=====================================================================`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${implAddress}`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
