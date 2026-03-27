import hre, { upgrades } from 'hardhat';

const EVOLVE_PROXY = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Signer:', signer.address);
  console.log('Upgrading proxy:', EVOLVE_PROXY);

  const Factory = await hre.ethers.getContractFactory('Mutation');
  const upgraded = await upgrades.upgradeProxy(EVOLVE_PROXY, Factory, {
    unsafeSkipStorageCheck: true,
  });
  await upgraded.waitForDeployment();

  const impl = await upgrades.erc1967.getImplementationAddress(EVOLVE_PROXY);
  console.log(`New implementation: ${impl}`);
  console.log(`\nVerify:\n  npx hardhat verify --network mainnet ${impl} --contract contracts/V2MainnetUpgrade/EtherPhunksEvolve.sol:Mutation`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
