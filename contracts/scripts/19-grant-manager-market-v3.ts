import hre from 'hardhat';

const pointsAddress = '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14';
const marketV3Address = '0x7DDe39623aF1D78651b0EEc754622b95bbD56896';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Granting POINTS_MANAGER_ROLE to Market V3');
  console.log(`  Signer:   ${signer.address}`);
  console.log(`  Points:   ${pointsAddress}`);
  console.log(`  Market:   ${marketV3Address}`);
  console.log('=====================================================================');

  // Wait 5 seconds in case we want to cancel
  await new Promise(resolve => setTimeout(resolve, 5000));

  const points = await hre.ethers.getContractAt('Points', pointsAddress);
  const tx = await points.grantManager(marketV3Address);
  console.log(`\n  tx: ${tx.hash}`);
  await tx.wait();

  console.log('  Confirmed! Market V3 can now award points.');
  console.log('=====================================================================\n');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
