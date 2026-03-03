import hre from 'hardhat';

const pointsAddress = '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14';

// ── Set these after deploying (script 36) ───────────────────
const standardLotteryProxy = '0x29b0d38112e8e743b63EB463F3351ab0F1E15977';
const premiumLotteryProxy  = '0x298771ECc338DE242ADa11e49E2B8224c33bf620';
// ─────────────────────────────────────────────────────────────

async function main() {
  const [signer] = await hre.ethers.getSigners();

  if (standardLotteryProxy === '0x0000000000000000000000000000000000000000') {
    console.error('\n  ERROR: Set proxy addresses before running!');
    console.error('  Deploy first (script 36), then paste addresses here.\n');
    process.exit(1);
  }

  console.log('\n=====================================================================');
  console.log('Granting POINTS_MANAGER_ROLE to both lottery proxies');
  console.log(`  Signer:   ${signer.address}`);
  console.log(`  Points:   ${pointsAddress}`);
  console.log(`  Standard: ${standardLotteryProxy}`);
  console.log(`  Premium:  ${premiumLotteryProxy}`);
  console.log('=====================================================================');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const points = await hre.ethers.getContractAt('Points', pointsAddress);

  console.log('\n  Granting to standard lottery...');
  const tx1 = await points.grantManager(standardLotteryProxy);
  console.log(`  tx: ${tx1.hash}`);
  await tx1.wait();
  console.log('  Confirmed!');

  console.log('\n  Granting to premium lottery...');
  const tx2 = await points.grantManager(premiumLotteryProxy);
  console.log(`  tx: ${tx2.hash}`);
  await tx2.wait();
  console.log('  Confirmed!');

  console.log('\n=====================================================================');
  console.log('Both lottery proxies can now award points.');
  console.log('=====================================================================\n');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
