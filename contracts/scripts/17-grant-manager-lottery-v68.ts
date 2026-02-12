import hre from 'hardhat';

const pointsAddress = '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14';
const lotteryV68Address = '0x4c6569909028F11873Ba5548900d4609a436bB98';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Granting POINTS_MANAGER_ROLE to Lottery V68');
  console.log(`  Signer:   ${signer.address}`);
  console.log(`  Points:   ${pointsAddress}`);
  console.log(`  Lottery:  ${lotteryV68Address}`);
  console.log('=====================================================================');

  // Wait 5 seconds in case we want to cancel
  await new Promise(resolve => setTimeout(resolve, 5000));

  const points = await hre.ethers.getContractAt('Points', pointsAddress);
  const tx = await points.grantManager(lotteryV68Address);
  console.log(`\n  tx: ${tx.hash}`);
  await tx.wait();

  console.log('  Confirmed! Lottery V68 can now award points.');
  console.log('=====================================================================\n');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
