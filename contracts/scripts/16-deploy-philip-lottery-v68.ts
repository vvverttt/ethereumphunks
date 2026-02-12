import hre from 'hardhat';

const contractName = 'PhilipLotteryV68';

// Set these before deploying:
const _playPrice = hre.ethers.parseEther('0.00001');
const _pointsAddress = '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14'; // Points V2
const _treasuryAddress = '0x19d57A31b982d3d75c16358795A4D19c803e4A72'; // Treasury

export async function deployPhilipLottery() {
  const [signer] = await hre.ethers.getSigners();

  if (_pointsAddress === '0x0000000000000000000000000000000000000000') {
    console.error('\n  ERROR: Set _pointsAddress before deploying!');
    console.error('  Deploy Points first (script 14), then paste the address here.\n');
    process.exit(1);
  }

  console.log('\n=====================================================================');
  console.log(`Deploying ${contractName} with account:`, signer.address);
  console.log('=====================================================================');

  // Wait 10 seconds in case we want to cancel
  await delay(10000);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const contract = await ContractFactory.deploy(_playPrice, _pointsAddress, _treasuryAddress);

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log('\n=====================================================================');
  console.log('SUMMARY:');
  console.log(`  PhilipLotteryV68: ${address}`);
  console.log(`  Owner:            ${signer.address}`);
  console.log(`  Play Price:       ${hre.ethers.formatEther(_playPrice)} ETH`);
  console.log(`  Points Address:   ${_pointsAddress}`);
  console.log(`  Treasury Address: ${_treasuryAddress}`);
  console.log('=====================================================================');
  console.log(`\nVerify with: npx hardhat verify --network mainnet ${address} "${_playPrice}" "${_pointsAddress}" "${_treasuryAddress}"`);
  console.log('\nNext steps:');
  console.log('  1. Verify on Etherscan');
  console.log('  2. grantManager(this address) on Points contract');
  console.log('  3. setPrice() if play price should be different');
  console.log('  4. Deposit prizes (send ethscriptions to this contract)');
  console.log('  5. Update lotteryAddress in frontend environment configs');
  console.log('  6. Withdraw prizes from old lottery (V67) if any remain');
  console.log('=====================================================================\n');
}

deployPhilipLottery().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}
