import hre from 'hardhat';

const pointsAddress = '0xA22a3E40C3C5A01F802c5698Af6Ed5fAA21095eb';
const marketV3Address = '0xa48a43186612B179C0bc68Ea34B4932549a70BfA';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Granting POINTS_MANAGER_ROLE to Marketplace');
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

  console.log('  Confirmed! Marketplace can now award points.');
  console.log('=====================================================================\n');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
