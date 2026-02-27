import hre from 'hardhat';

const pointsAddress = '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14';
const ethsrocksAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Granting POINTS_MANAGER_ROLE to EthsRocks');
  console.log(`  Signer:     ${signer.address}`);
  console.log(`  Points:     ${pointsAddress}`);
  console.log(`  EthsRocks:  ${ethsrocksAddress}`);
  console.log('=====================================================================');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const points = await hre.ethers.getContractAt('Points', pointsAddress);
  const tx = await points.grantManager(ethsrocksAddress);
  console.log(`\n  tx: ${tx.hash}`);
  await tx.wait();

  console.log('  Confirmed! EthsRocks can now award points.');
  console.log('=====================================================================\n');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
