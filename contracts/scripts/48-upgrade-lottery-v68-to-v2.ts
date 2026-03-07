import hre, { upgrades } from 'hardhat';

const premiumProxy = '0x298771ECc338DE242ADa11e49E2B8224c33bf620';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading PhilipLotteryV68 → V68_V2 (match standard lottery features)');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Premium Proxy:  ${premiumProxy}`);
  console.log('  Changes: add commit-reveal, batch withdraw, emergency withdraw,');
  console.log('           pull payments, storage gap');
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory('PhilipLotteryV68_V2');

  console.log('\nUpgrading premium lottery proxy...');
  const upgraded = await upgrades.upgradeProxy(premiumProxy, ContractFactory, {
    unsafeSkipStorageCheck: true,
  });
  await upgraded.waitForDeployment();
  const implAddress = await upgrades.erc1967.getImplementationAddress(premiumProxy);
  console.log(`  Premium new impl: ${implAddress}`);

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Premium Proxy:  ${premiumProxy}`);
  console.log(`  New Impl:       ${implAddress}`);
  console.log(`=====================================================================`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${implAddress}`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
