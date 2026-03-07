import hre, { upgrades } from 'hardhat';

const standardProxy = '0x29b0d38112e8e743b63EB463F3351ab0F1E15977';
const premiumProxy = '0x298771ECc338DE242ADa11e49E2B8224c33bf620';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading both lotteries with audit fixes');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Standard Proxy:  ${standardProxy}`);
  console.log(`  Premium Proxy:   ${premiumProxy}`);
  console.log('  Fixes: totalCommittedETH protection, storage gap,');
  console.log('         emergency withdraw check, RefundEscrowed event,');
  console.log('         redirectPendingReturns');
  console.log('=====================================================================');

  // --- Standard lottery (V67) ---
  console.log('\n[1/2] Upgrading standard lottery (PhilipLotteryV67)...');
  const V67Factory = await hre.ethers.getContractFactory('PhilipLotteryV67');
  const upgradedV67 = await upgrades.upgradeProxy(standardProxy, V67Factory, {
    unsafeSkipStorageCheck: true,
  });
  await upgradedV67.waitForDeployment();
  const implV67 = await upgrades.erc1967.getImplementationAddress(standardProxy);
  console.log(`  Standard new impl: ${implV67}`);

  // --- Premium lottery (V68_V2) ---
  console.log('\n[2/2] Upgrading premium lottery (PhilipLotteryV68_V2)...');
  const V68Factory = await hre.ethers.getContractFactory('PhilipLotteryV68_V2');
  const upgradedV68 = await upgrades.upgradeProxy(premiumProxy, V68Factory, {
    unsafeSkipStorageCheck: true,
  });
  await upgradedV68.waitForDeployment();
  const implV68 = await upgrades.erc1967.getImplementationAddress(premiumProxy);
  console.log(`  Premium new impl: ${implV68}`);

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Standard Proxy:  ${standardProxy}  →  impl: ${implV67}`);
  console.log(`  Premium Proxy:   ${premiumProxy}  →  impl: ${implV68}`);
  console.log(`=====================================================================`);
  console.log(`\nVerify:`);
  console.log(`  npx hardhat verify --network mainnet ${implV67}`);
  console.log(`  npx hardhat verify --network mainnet ${implV68}`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
