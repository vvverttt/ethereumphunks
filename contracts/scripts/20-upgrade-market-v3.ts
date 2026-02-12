import hre from 'hardhat';

const proxyAddress = '0x7DDe39623aF1D78651b0EEc754622b95bbD56896';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Upgrading EtherPhunksMarketV3 implementation');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log('=====================================================================');

  const EtherPhunksMarketV3 = await hre.ethers.getContractFactory('EtherPhunksMarketV3');
  const upgraded = await hre.upgrades.upgradeProxy(proxyAddress, EtherPhunksMarketV3);
  await upgraded.waitForDeployment();

  const implAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Proxy (unchanged):     ${proxyAddress}`);
  console.log(`  New Implementation:    ${implAddress}`);
  console.log(`  Change: _addPoints now awards buyer (msg.sender) instead of seller`);
  console.log(`=====================================================================\n`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
