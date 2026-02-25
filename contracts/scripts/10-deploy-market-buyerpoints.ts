import hre, { upgrades } from 'hardhat';

const contractName = 'EtherPhunksMarketV2_1';

const _version = 1;
const _pointsAddress = '0x28AbBC0A90d10870bcbf2d14256c6cC791090E86';
const _revShareAddress = '0xA392be17E79F7e9fc2Fb9689Ef6B1BfB033974c4';
const _revSharePercentage = 6700; // 6.7% (out of 100000)
const _adminWallet = '0x19d57a31b982d3d75c16358795a4d19c803e4a72';

export async function deployMarket() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log(`Deploying ${contractName} with account:`, signer.address);
  console.log('=====================================================================');

  // Step 1: Deploy proxy with initialize(version, pointsAddress)
  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  const contract = await upgrades.deployProxy(
    ContractFactory,
    [_version, _pointsAddress],
    { initializer: 'initialize' }
  );

  await contract.waitForDeployment();
  const proxyAddress = await contract.getAddress();

  console.log('\n=====================================================================');
  console.log(`Proxy deployed to:`, proxyAddress);
  console.log('=====================================================================');

  // Step 2: Call initializeV2_1 (reinitializer(3)) to set revShare
  console.log('\nCalling initializeV2_1...');
  const tx1 = await contract.initializeV2_1(3, _revShareAddress, _revSharePercentage);
  await tx1.wait();
  console.log('initializeV2_1 called successfully');

  // Log addresses
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log('\n=====================================================================');
  console.log('SUMMARY:');
  console.log(`  Proxy:          ${proxyAddress}`);
  console.log(`  Implementation: ${implAddress}`);
  console.log(`  Owner:          ${signer.address} (deployer)`);
  console.log(`  RevShare:       ${_revShareAddress} (${_revSharePercentage / 1000}%)`);
  console.log(`  Points:         ${_pointsAddress}`);
  console.log('=====================================================================');
  console.log(`\nVerify with: npx hardhat verify --network mainnet ${implAddress}`);
  console.log('=====================================================================\n');
}

deployMarket().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
