import hre, { upgrades } from 'hardhat';

const premiumProxy = '0x298771ECc338DE242ADa11e49E2B8224c33bf620';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  console.log(`Upgrading premium lottery (PhilipLotteryV68_V2)...`);

  const V68Factory = await hre.ethers.getContractFactory('PhilipLotteryV68_V2');
  const upgraded = await upgrades.upgradeProxy(premiumProxy, V68Factory, {
    unsafeSkipStorageCheck: true,
  });
  await upgraded.waitForDeployment();
  const impl = await upgrades.erc1967.getImplementationAddress(premiumProxy);
  console.log(`  Premium new impl: ${impl}`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${impl}`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
