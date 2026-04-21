import hre, { upgrades } from 'hardhat';

const proxyAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
const contractName = 'EthsRocks';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const apiPrivateKey = process.env.API_PRIVATE_KEY;

  if (!apiPrivateKey) {
    throw new Error('API_PRIVATE_KEY env var is required');
  }

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
  const normalizedApiPrivateKey = apiPrivateKey.startsWith('0x') ? apiPrivateKey : `0x${apiPrivateKey}`;
  const signerWallet = new hre.ethers.Wallet(normalizedApiPrivateKey);
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
