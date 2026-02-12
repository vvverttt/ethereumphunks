import { ethers } from 'hardhat';
import hre from 'hardhat';

const contractName = 'Points';

async function deployPoints() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n\n=====================================================================');
  console.log(`Deploying ${contractName} contract with the account:`, signer.address);

  // Get the ContractFactory
  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  // Simulate deployment to estimate gas
  const deploymentTransaction = await ContractFactory.getDeployTransaction();
  const estimatedGas = await ethers.provider.estimateGas(deploymentTransaction);
  const feeData = await ethers.provider.getFeeData();

  console.log('\nDeployment costs:');
  console.log({
    estimatedGas: Number(estimatedGas),
    gasPrice: Number(feeData.gasPrice),
    total: Number(estimatedGas) * Number(feeData.gasPrice),
    eth: ethers.formatEther(BigInt(`${Number(estimatedGas) * Number(feeData.gasPrice)}`)),
  });
  console.log('=====================================================================');

  // Wait 10 seconds in case we want to cancel the deployment
  await delay(10000);

  // Deploy the contract
  const contract = await ContractFactory.deploy();
  const contractAddress = await contract.getAddress();

  // Wait for the contract to be deployed
  await contract.waitForDeployment();

  console.log('\n=====================================================================');
  console.log('SUMMARY:');
  console.log(`  Points:  ${contractAddress}`);
  console.log(`  Owner:   ${signer.address}`);
  console.log('=====================================================================');
  console.log(`\nVerify with: npx hardhat verify --network mainnet ${contractAddress}`);
  console.log('\nNext steps:');
  console.log('  1. Verify on Etherscan');
  console.log('  2. grantManager(marketplaceAddress) — so market can award points');
  console.log('  3. grantManager(lotteryV68Address)  — so lottery can award points');
  console.log('  4. setPointsAddress(newPointsAddr)  — on marketplace contract');
  console.log('=====================================================================\n');

  return contractAddress;
}

deployPoints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}
