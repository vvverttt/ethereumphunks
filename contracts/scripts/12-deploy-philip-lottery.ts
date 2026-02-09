import hre from 'hardhat';

const contractName = 'PhilipLotteryV67';

// Initial play price: 0.00001 ETH
const _playPrice = hre.ethers.parseEther('0.00001');

export async function deployPhilipLottery() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log(`Deploying ${contractName} with account:`, signer.address);
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const contract = await ContractFactory.deploy(_playPrice);

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log('\n=====================================================================');
  console.log('SUMMARY:');
  console.log(`  PhilipLotteryV67: ${address}`);
  console.log(`  Owner:            ${signer.address}`);
  console.log(`  Play Price:       ${hre.ethers.formatEther(_playPrice)} ETH`);
  console.log('=====================================================================');
  console.log(`\nVerify with: npx hardhat verify --network mainnet ${address} "${_playPrice}"`);
  console.log('\nNext steps:');
  console.log(`  1. Verify on Etherscan`);
  console.log(`  2. Add lotteryAddress to environment configs`);
  console.log(`  3. Populate lottery_pool table in Supabase`);
  console.log('=====================================================================\n');
}

deployPhilipLottery().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
