import hre, { upgrades } from 'hardhat';

const contractName = 'EthsRocks';

const _treasuryAddress = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';
const _pointsAddress = '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14';
const _merkleRoot = '0x0000000000000000000000000000000000000000000000000000000000000000'; // Set after generating
const _philipInternAddress = '0xa82f3a61f002f83eba7d184c50bb2a8b359ca1ce';
const _wrappedV1Address = '0x235d49774139c218034c0571ba8f717773edd923';
const _cryptoPhunksV2Address = '0xf07468ead8cf26c752c676e43c814fee9c8cf402';

async function deploy() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log(`Deploying ${contractName} (upgradeable) with account:`, signer.address);
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const args = [
    _treasuryAddress,
    _pointsAddress,
    _merkleRoot,
    _philipInternAddress,
    _wrappedV1Address,
    _cryptoPhunksV2Address,
  ];

  const contract = await upgrades.deployProxy(
    ContractFactory,
    args,
    { initializer: 'initialize' }
  );

  await contract.waitForDeployment();
  const proxyAddress = await contract.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);

  console.log('\nSUMMARY:');
  console.log(`  Proxy:            ${proxyAddress}`);
  console.log(`  Implementation:   ${implAddress}`);
  console.log(`  ProxyAdmin:       ${adminAddress}`);
  console.log(`  Treasury:         ${_treasuryAddress}`);
  console.log(`  Points:           ${_pointsAddress}`);
  console.log(`  PhilipIntern:     ${_philipInternAddress}`);
  console.log(`  WrappedV1:        ${_wrappedV1Address}`);
  console.log(`  CryptoPhunksV2:   ${_cryptoPhunksV2Address}`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${implAddress}`);
  console.log('\nNext steps:');
  console.log('  1. Verify implementation on Etherscan');
  console.log('  2. grantManager(proxyAddress) on Points contract');
  console.log('  3. Run generate-merkle-root.ts to get merkle root');
  console.log('  4. Call setMerkleRoot(root) on the proxy');
  console.log('  5. Deposit 69 EthsRocks ethscriptions via fallback');
  console.log('  6. Unpause if needed');
}

deploy().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
