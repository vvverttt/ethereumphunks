import hre, { upgrades } from 'hardhat';

const PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

async function upgradeMutation() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading Mutation at proxy:', PROXY_ADDRESS);
  console.log('  Signer:', signer.address);
  console.log('=====================================================================');

  const MutationV2 = await hre.ethers.getContractFactory('Mutation');
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, MutationV2);
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);

  console.log('\n=====================================================================');
  console.log('Upgrade complete!');
  console.log(`  Proxy:              ${PROXY_ADDRESS}`);
  console.log(`  New Implementation: ${newImpl}`);
  console.log('=====================================================================\n');
}

upgradeMutation().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
