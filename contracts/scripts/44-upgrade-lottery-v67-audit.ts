import hre, { upgrades } from 'hardhat';

const standardProxy = '0x29b0d38112e8e743b63EB463F3351ab0F1E15977';
const premiumProxy  = '0x298771ECc338DE242ADa11e49E2B8224c33bf620';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading PhilipLotteryV67 (both proxies) — Audit fixes');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Standard Proxy: ${standardProxy}`);
  console.log(`  Premium Proxy:  ${premiumProxy}`);
  console.log('  Changes: min price validation, nonReentrant withdrawPrize');
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory('PhilipLotteryV67');

  // Upgrade standard proxy
  console.log('\nUpgrading standard lottery proxy...');
  const upgraded1 = await upgrades.upgradeProxy(standardProxy, ContractFactory, {
    unsafeSkipStorageCheck: true,
  });
  await upgraded1.waitForDeployment();
  const implAddress1 = await upgrades.erc1967.getImplementationAddress(standardProxy);
  console.log(`  Standard new impl: ${implAddress1}`);

  // Upgrade premium proxy
  console.log('Upgrading premium lottery proxy...');
  const upgraded2 = await upgrades.upgradeProxy(premiumProxy, ContractFactory, {
    unsafeSkipStorageCheck: true,
  });
  await upgraded2.waitForDeployment();
  const implAddress2 = await upgrades.erc1967.getImplementationAddress(premiumProxy);
  console.log(`  Premium new impl:  ${implAddress2}`);

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Standard Proxy:    ${standardProxy}`);
  console.log(`  Standard Impl:     ${implAddress1}`);
  console.log(`  Premium Proxy:     ${premiumProxy}`);
  console.log(`  Premium Impl:      ${implAddress2}`);
  console.log(`=====================================================================`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${implAddress1}`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
