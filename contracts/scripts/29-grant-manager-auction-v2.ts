import hre from 'hardhat';

const pointsAddress = '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14';
const auctionAddress = '0x0000000000000000000000000000000000000000'; // SET AFTER DEPLOY

async function main() {
  if (auctionAddress === '0x0000000000000000000000000000000000000000') {
    console.error('\n  ERROR: Set auctionAddress before running!\n');
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Granting POINTS_MANAGER_ROLE to Auction House V2');
  console.log(`  Signer:   ${signer.address}`);
  console.log(`  Points:   ${pointsAddress}`);
  console.log(`  Auction:  ${auctionAddress}`);
  console.log('=====================================================================');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const points = await hre.ethers.getContractAt('Points', pointsAddress);
  const tx = await points.grantManager(auctionAddress);
  console.log(`\n  tx: ${tx.hash}`);
  await tx.wait();

  console.log('  Confirmed! Auction House V2 can now award points.');
  console.log('=====================================================================\n');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
