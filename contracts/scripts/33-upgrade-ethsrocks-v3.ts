import hre, { upgrades } from 'hardhat';

const proxyAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
const contractName = 'EthsRocks';

// First purchase tokens to reset
const FIRST_PURCHASE = {
  missingPhunkHash: '0xfb42cc3bcb57cd278833809b8e664c50224eb7ec7ca665ca6f454db7705f1cc4',
  quantumDystoHash: '0x7abaa6e344d466f13ea8363219fd4c5079f8b2f0a49cee1a0e129d5e46326cd8',
  quantumPhunkHash: '0x9db0b73cfbaa87e292eb3e95f2633bdc90557934971e1400dac9b076dc038093',
  philipInternTokenId: 9889,
  cryptoPhunksV2TokenId: 2556,
};

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log(`Upgrading ${contractName} to V3 (halve BASE_PRICE + reset first sale)`);
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log(`  New BASE_PRICE: 0.00245 ETH`);
  console.log('=====================================================================');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // 1. Upgrade implementation
  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const upgraded = await upgrades.upgradeProxy(proxyAddress, ContractFactory);
  await upgraded.waitForDeployment();

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`\n  New implementation: ${newImplAddress}`);

  // 2. Reset first sale state
  const contract = await hre.ethers.getContractAt(contractName, proxyAddress);

  // Reset totalRevealed to 0
  console.log('\n  Resetting totalRevealed to 0...');
  let tx = await contract.resetTotalRevealed(0);
  await tx.wait();
  console.log(`    tx: ${tx.hash}`);

  // Reset used ethscriptions
  console.log('  Resetting used ethscriptions...');
  tx = await contract.resetUsedEthscription(FIRST_PURCHASE.missingPhunkHash);
  await tx.wait();
  console.log(`    missingPhunk: ${tx.hash}`);

  tx = await contract.resetUsedEthscription(FIRST_PURCHASE.quantumDystoHash);
  await tx.wait();
  console.log(`    quantumDysto: ${tx.hash}`);

  tx = await contract.resetUsedEthscription(FIRST_PURCHASE.quantumPhunkHash);
  await tx.wait();
  console.log(`    quantumPhunk: ${tx.hash}`);

  // Reset used ERC-721s
  console.log('  Resetting used ERC-721s...');
  const philipInternAddress = await contract.philipInternAddress();
  const cryptoPhunksV2Address = await contract.cryptoPhunksV2Address();

  tx = await contract.resetUsedERC721(philipInternAddress, FIRST_PURCHASE.philipInternTokenId);
  await tx.wait();
  console.log(`    PhilipIntern #${FIRST_PURCHASE.philipInternTokenId}: ${tx.hash}`);

  tx = await contract.resetUsedERC721(cryptoPhunksV2Address, FIRST_PURCHASE.cryptoPhunksV2TokenId);
  await tx.wait();
  console.log(`    CryptoPhunksV2 #${FIRST_PURCHASE.cryptoPhunksV2TokenId}: ${tx.hash}`);

  console.log('\n=====================================================================');
  console.log('Done! Summary:');
  console.log(`  - New implementation: ${newImplAddress}`);
  console.log('  - BASE_PRICE: 0.0049 -> 0.00245 ETH');
  console.log('  - totalRevealed: reset to 0');
  console.log('  - First purchase tokens: all reset (can be reused)');
  console.log('  - User must send rock back to contract to re-add to pool');
  console.log(`\nVerify: npx hardhat verify --network mainnet ${newImplAddress}`);
  console.log('=====================================================================\n');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
