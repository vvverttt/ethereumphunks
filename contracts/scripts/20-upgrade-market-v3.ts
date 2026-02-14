import hre from 'hardhat';

const proxyAddress = '0xE14f7585F50b80E39FceF13cB26a54F01BB4bC4C';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading EtherPhunksMarketV3 implementation');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log('=====================================================================');

  const EtherPhunksMarketV3 = await hre.ethers.getContractFactory('EtherPhunksMarketV3');

  console.log('Upgrading implementation...');
  const upgraded = await hre.upgrades.upgradeProxy(proxyAddress, EtherPhunksMarketV3);
  await upgraded.waitForDeployment();

  const implAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Proxy (unchanged):     ${proxyAddress}`);
  console.log(`  New Implementation:    ${implAddress}`);
  console.log(`  Change: Royalties sent directly to receiver instead of pendingWithdrawals`);
  console.log(`=====================================================================\n`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
