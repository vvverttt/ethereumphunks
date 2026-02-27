import hre, { upgrades } from 'hardhat';

const proxyAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
const contractName = 'EthsRocks';

// Signer address derived from API_PRIVATE_KEY (will be set after upgrade)
// API_PRIVATE_KEY = 75c5d7c962a7ea097f3f6c7dacb95e20afc6aa62de20a8ca04a0973cfecba0f5

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log(`Upgrading ${contractName} to V2 (signer-based verification)`);
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log('=====================================================================');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const upgraded = await upgrades.upgradeProxy(proxyAddress, ContractFactory);
  await upgraded.waitForDeployment();

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log(`\n  New implementation: ${newImplAddress}`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${newImplAddress}`);

  // Derive signer address from API_PRIVATE_KEY
  const signerWallet = new hre.ethers.Wallet('0x75c5d7c962a7ea097f3f6c7dacb95e20afc6aa62de20a8ca04a0973cfecba0f5');
  console.log(`\n  Signer wallet address: ${signerWallet.address}`);

  // Set signer address on the contract
  const contract = await hre.ethers.getContractAt(contractName, proxyAddress);
  const tx = await contract.setSignerAddress(signerWallet.address);
  console.log(`  setSignerAddress tx: ${tx.hash}`);
  await tx.wait();
  console.log('  Confirmed! Signer address set.');

  console.log('\n=====================================================================');
  console.log('Next steps:');
  console.log('  1. Verify new implementation on Etherscan');
  console.log('  2. Add signing endpoint to indexer');
  console.log('  3. Unpause when ready');
  console.log('=====================================================================\n');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
