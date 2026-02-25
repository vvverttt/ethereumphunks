import hre from 'hardhat';

const contractName = 'EtherPhunksAuctionHouseV2';

// Set these before deploying:
const _duration = 86400;                                      // 24 hours
const _timeBuffer = 600;                                      // 10 minutes
const _minBidIncrementPercentage = 10;                        // 10%
const _reservePrice = hre.ethers.parseEther('0.001');         // 0.001 ETH
const _pointsAddress = '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14';
const _treasuryAddress = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

async function deploy() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log(`Deploying ${contractName} with account:`, signer.address);
  console.log('=====================================================================');

  // Wait 10 seconds in case we want to cancel
  await new Promise(resolve => setTimeout(resolve, 10000));

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const contract = await ContractFactory.deploy(
    _duration,
    _timeBuffer,
    _minBidIncrementPercentage,
    _reservePrice,
    _pointsAddress,
    _treasuryAddress
  );

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log('\n=====================================================================');
  console.log('SUMMARY:');
  console.log(`  ${contractName}:       ${address}`);
  console.log(`  Owner:                  ${signer.address}`);
  console.log(`  Duration:               ${_duration}s (${_duration / 3600}h)`);
  console.log(`  Time Buffer:            ${_timeBuffer}s (${_timeBuffer / 60}min)`);
  console.log(`  Min Bid Increment:      ${_minBidIncrementPercentage}%`);
  console.log(`  Reserve Price:          ${hre.ethers.formatEther(_reservePrice)} ETH`);
  console.log(`  Points Address:         ${_pointsAddress}`);
  console.log(`  Treasury Address:       ${_treasuryAddress}`);
  console.log('=====================================================================');
  console.log(`\nVerify with: npx hardhat verify --network mainnet ${address} "${_duration}" "${_timeBuffer}" "${_minBidIncrementPercentage}" "${_reservePrice}" "${_pointsAddress}" "${_treasuryAddress}"`);
  console.log('\nNext steps:');
  console.log('  1. Verify on Etherscan');
  console.log('  2. grantManager(this address) on Points contract (script 29)');
  console.log('  3. Deposit ethscriptions (send to this contract address)');
  console.log('  4. setItemReservePrices() for per-item prices');
  console.log('  5. Call settleAndCreate() to start first auction');
  console.log('=====================================================================\n');
}

deploy().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
