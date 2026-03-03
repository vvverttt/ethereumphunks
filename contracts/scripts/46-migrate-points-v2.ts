import hre from 'hardhat';

const newPointsAddress = '0xA22a3E40C3C5A01F802c5698Af6Ed5fAA21095eb';

// All contracts that call addPoints
const marketV3Proxy = '0xa48a43186612B179C0bc68Ea34B4932549a70BfA';
const auctionProxy  = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';
const ethsRocksProxy = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
const lotteryStandardProxy = '0x29b0d38112e8e743b63EB463F3351ab0F1E15977';
const lotteryPremiumProxy  = '0x298771ECc338DE242ADa11e49E2B8224c33bf620';

// Points ABI (only what we need)
const pointsABI = [
  'function grantManager(address manager) public',
  'function POINTS_MANAGER_ROLE() public view returns (bytes32)',
  'function hasRole(bytes32 role, address account) public view returns (bool)',
];

// Contract ABI for setPointsAddress
const setPointsABI = [
  'function setPointsAddress(address _pointsAddress) external',
  'function pointsAddress() public view returns (address)',
];

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Points V2 Migration');
  console.log(`  Signer:        ${signer.address}`);
  console.log(`  New Points:    ${newPointsAddress}`);
  console.log('=====================================================================');

  const points = new hre.ethers.Contract(newPointsAddress, pointsABI, signer);
  const POINTS_MANAGER_ROLE = await points.POINTS_MANAGER_ROLE();

  // Step 1: Grant POINTS_MANAGER_ROLE to all contracts
  const managers = [
    ['MarketV3', marketV3Proxy],
    ['AuctionHouseV2', auctionProxy],
    ['EthsRocks', ethsRocksProxy],
    ['Lottery Standard', lotteryStandardProxy],
    ['Lottery Premium', lotteryPremiumProxy],
  ];

  for (const [name, addr] of managers) {
    const hasRole = await points.hasRole(POINTS_MANAGER_ROLE, addr);
    if (hasRole) {
      console.log(`  ${name} already has POINTS_MANAGER_ROLE — skip`);
    } else {
      console.log(`  Granting POINTS_MANAGER_ROLE to ${name} (${addr})...`);
      const tx = await points.grantManager(addr);
      await tx.wait();
      console.log(`    ✓ Done (tx: ${tx.hash})`);
    }
  }

  // Step 2: Update pointsAddress on each contract
  const contracts = [
    ['MarketV3', marketV3Proxy],
    ['AuctionHouseV2', auctionProxy],
    ['EthsRocks', ethsRocksProxy],
    ['Lottery Standard', lotteryStandardProxy],
    ['Lottery Premium', lotteryPremiumProxy],
  ];

  for (const [name, addr] of contracts) {
    const contract = new hre.ethers.Contract(addr, setPointsABI, signer);
    const currentPoints = await contract.pointsAddress();
    if (currentPoints.toLowerCase() === newPointsAddress.toLowerCase()) {
      console.log(`  ${name} already points to new address — skip`);
    } else {
      console.log(`  Updating ${name} pointsAddress (${currentPoints} → ${newPointsAddress})...`);
      const tx = await contract.setPointsAddress(newPointsAddress);
      await tx.wait();
      console.log(`    ✓ Done (tx: ${tx.hash})`);
    }
  }

  console.log('\n=====================================================================');
  console.log('Points V2 Migration Complete!');
  console.log(`  Old Points: 0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14`);
  console.log(`  New Points: ${newPointsAddress}`);
  console.log('=====================================================================');
  console.log('\nRemember to update frontend/indexer env configs with new Points address.');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
