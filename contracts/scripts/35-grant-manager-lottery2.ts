import hre from 'hardhat';

const pointsAddress = '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14';
const lottery2Address = '0xD69AaB22c98536D6C623a748D8CA7202c120BA81';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Granting POINTS_MANAGER_ROLE to Lottery V68 (2)');
  console.log(`  Signer:   ${signer.address}`);
  console.log(`  Points:   ${pointsAddress}`);
  console.log(`  Lottery2: ${lottery2Address}`);
  console.log('=====================================================================');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const points = await hre.ethers.getContractAt('Points', pointsAddress);
  const tx = await points.grantManager(lottery2Address);
  console.log(`\n  tx: ${tx.hash}`);
  await tx.wait();

  console.log('  Confirmed! Lottery V68 (2) can now award points.');
  console.log('=====================================================================\n');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
