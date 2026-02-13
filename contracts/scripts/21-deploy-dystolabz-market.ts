import hre, { upgrades } from 'hardhat';

/**
 * Step 1: Deploy fresh proxy with EtherPhunksMarket (V1) — exact OG code
 * Step 2: Upgrade to DystoLabzMarket — adds multi-receiver royalties
 */

const _contractVersion = 1;
const _pointsAddress = '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14'; // Points V2
const _upgradedVersion = 2;

// Royalty receivers — each with their own bps from sale price
// Total must be <= 1000 (10%)
const _royaltyReceivers = [
  '0x19d57A31b982d3d75c16358795A4D19c803e4A72', // Treasury
];
const _royaltyBps = [
  367, // 3.67%
];

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Step 1: Deploying EtherPhunksMarket (V1) proxy');
  console.log(`  Signer: ${signer.address}`);
  console.log('=====================================================================');

  // Wait 10 seconds in case we want to cancel
  await delay(10000);

  // Step 1: Deploy V1 proxy
  const V1Factory = await hre.ethers.getContractFactory('EtherPhunksMarket');
  const v1Proxy = await upgrades.deployProxy(
    V1Factory,
    [_contractVersion, _pointsAddress],
    { initializer: 'initialize' }
  );

  await v1Proxy.waitForDeployment();
  const proxyAddress = await v1Proxy.getAddress();
  const v1ImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);

  console.log('\n  V1 Proxy deployed!');
  console.log(`  Proxy:          ${proxyAddress}`);
  console.log(`  Implementation: ${v1ImplAddress}`);
  console.log(`  ProxyAdmin:     ${adminAddress}`);

  console.log('\n=====================================================================');
  console.log('Step 2: Upgrading to DystoLabzMarket (adds royalties)');
  console.log('=====================================================================');

  // Step 2: Upgrade to DystoLabzMarket
  const DystoLabzFactory = await hre.ethers.getContractFactory('DystoLabzMarket');
  const upgraded = await upgrades.upgradeProxy(proxyAddress, DystoLabzFactory, {
    call: {
      fn: 'initializeRoyalties',
      args: [_upgradedVersion, _royaltyReceivers, _royaltyBps]
    }
  });

  await upgraded.waitForDeployment();
  const newImplAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  const totalBps = _royaltyBps.reduce((a, b) => a + b, 0);

  console.log('\n=====================================================================');
  console.log('DEPLOYMENT COMPLETE:');
  console.log(`  Proxy:              ${proxyAddress}`);
  console.log(`  V1 Implementation:  ${v1ImplAddress}`);
  console.log(`  V2 Implementation:  ${newImplAddress}`);
  console.log(`  ProxyAdmin:         ${adminAddress}`);
  console.log(`  Owner:              ${signer.address}`);
  console.log(`  Points Address:     ${_pointsAddress}`);
  console.log(`  Royalty Receivers:`);
  for (let i = 0; i < _royaltyReceivers.length; i++) {
    console.log(`    ${_royaltyReceivers[i]} → ${_royaltyBps[i]} bps (${_royaltyBps[i] / 100}%)`);
  }
  console.log(`  Total Royalty:      ${totalBps} bps (${totalBps / 100}%)`);
  console.log('=====================================================================');
  console.log('\nNext steps:');
  console.log('  1. Verify implementation on Etherscan');
  console.log('  2. grantManager(proxyAddress) on Points contract');
  console.log('  3. Update frontend marketAddress in environment configs');
  console.log('  4. Update frontend ABI');
  console.log('=====================================================================\n');
}

main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
