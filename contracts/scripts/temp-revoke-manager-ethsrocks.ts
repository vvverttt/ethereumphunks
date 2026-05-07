import hre from 'hardhat';

const pointsAddress = '0xA22a3E40C3C5A01F802c5698Af6Ed5fAA21095eb';
const ethsrocksAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
const expectedAdmin = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Revoking POINTS_MANAGER_ROLE from EthsRocks');
  console.log(`  Signer:     ${signer.address}`);
  console.log(`  Points:     ${pointsAddress}`);
  console.log(`  EthsRocks:  ${ethsrocksAddress}`);
  console.log('=====================================================================');

  if (signer.address.toLowerCase() !== expectedAdmin.toLowerCase()) {
    throw new Error(
      `Wrong signer. Expected Points admin ${expectedAdmin}, got ${signer.address}`
    );
  }

  const points = await hre.ethers.getContractAt('Points', pointsAddress);
  const defaultAdminRole = await points.DEFAULT_ADMIN_ROLE();
  const managerRole = await points.POINTS_MANAGER_ROLE();

  const signerIsAdmin = await points.hasRole(defaultAdminRole, signer.address);
  if (!signerIsAdmin) {
    throw new Error(`Signer ${signer.address} is not DEFAULT_ADMIN_ROLE on Points`);
  }

  const hasManagerRole = await points.hasRole(managerRole, ethsrocksAddress);

  console.log(`  Signer is DEFAULT_ADMIN_ROLE: ${signerIsAdmin}`);
  console.log(`  EthsRocks currently has manager role: ${hasManagerRole}`);

  if (!hasManagerRole) {
    console.log('\n  No action needed. EthsRocks is already not a manager.');
    console.log('=====================================================================\n');
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 5000));

  const tx = await points.revokeManager(ethsrocksAddress);
  console.log(`\n  tx: ${tx.hash}`);
  await tx.wait();

  const stillHasRole = await points.hasRole(managerRole, ethsrocksAddress);
  console.log(`  EthsRocks still has manager role: ${stillHasRole}`);
  console.log('  Confirmed! EthsRocks can no longer award points.');
  console.log('=====================================================================\n');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
