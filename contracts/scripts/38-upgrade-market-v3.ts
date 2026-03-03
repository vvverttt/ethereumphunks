import hre, { upgrades } from 'hardhat';

const proxyAddress = '0xa48a43186612B179C0bc68Ea34B4932549a70BfA';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading EtherPhunksMarketV3 implementation');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log('  Change:  Add __gap + renounceOwnership override');
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory('EtherPhunksMarketV3');

  console.log('Upgrading implementation...');
  // Storage manifest is stale (from old V2 before V3 fresh deploy).
  // V3 is already live; we're only appending __gap + renounceOwnership.
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
