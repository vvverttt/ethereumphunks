import hre, { upgrades } from 'hardhat';

const proxyAddress = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading Mutation (Evolve) — Audit fixes');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log('  Changes: _disableInitializers, dup guard, refund excess, revert receive');
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory('Mutation');

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
