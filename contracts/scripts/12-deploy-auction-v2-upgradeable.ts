import hre, { upgrades } from 'hardhat';

const contractName = 'EtherPhunksAuctionHouseV2';

const _duration = 86400;          // 24 hours
const _timeBuffer = 600;          // 10 minutes
const _minBidIncrementPercentage = 10;
const _reservePrice = hre.ethers.parseEther('0.001');
const _pointsAddress = '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14';
const _treasuryAddress = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

async function deploy() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log(`Deploying ${contractName} (upgradeable) with account:`, signer.address);
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const args = [
    _duration,
    _timeBuffer,
    _minBidIncrementPercentage,
    _reservePrice,
    _pointsAddress,
    _treasuryAddress,
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
  console.log(`  Proxy:          ${proxyAddress}`);
  console.log(`  Implementation: ${implAddress}`);
  console.log(`  ProxyAdmin:     ${adminAddress}`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${implAddress}`);
}

deploy().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
