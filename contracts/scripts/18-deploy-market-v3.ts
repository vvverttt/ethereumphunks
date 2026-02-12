import hre, { upgrades } from 'hardhat';

const contractName = 'EtherPhunksMarketV3';

// Set these before deploying:
const _contractVersion = 3;
const _pointsAddress = '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14'; // Points V2
const _royaltyBps = 367; // 3.67%
const _royaltyReceiver = '0x19d57A31b982d3d75c16358795A4D19c803e4A72'; // Treasury

export async function deployMarketV3() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log(`Deploying ${contractName} with account:`, signer.address);
  console.log('=====================================================================');

  // Wait 10 seconds in case we want to cancel
  await delay(10000);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const contract = await upgrades.deployProxy(
    ContractFactory,
    [_contractVersion, _pointsAddress, _royaltyBps, _royaltyReceiver],
    { initializer: 'initialize' }
  );

  await contract.waitForDeployment();
  const proxyAddress = await contract.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);

  console.log('\n=====================================================================');
  console.log('SUMMARY:');
  console.log(`  Proxy:            ${proxyAddress}`);
  console.log(`  Implementation:   ${implAddress}`);
  console.log(`  ProxyAdmin:       ${adminAddress}`);
  console.log(`  Owner:            ${signer.address}`);
  console.log(`  Points Address:   ${_pointsAddress}`);
  console.log(`  Royalty BPS:      ${_royaltyBps} (${_royaltyBps / 100}%)`);
  console.log(`  Royalty Receiver: ${_royaltyReceiver}`);
  console.log('=====================================================================');
  console.log('\nNext steps:');
  console.log('  1. Verify implementation on Etherscan');
  console.log('  2. grantManager(proxyAddress) on Points contract');
  console.log('  3. Update frontend marketAddress in environment configs');
  console.log('  4. Update frontend ABI to V3');
  console.log('=====================================================================\n');
}

deployMarketV3().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
