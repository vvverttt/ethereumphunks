import hre, { upgrades } from 'hardhat';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const treasuryAddress = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

  console.log('\n=====================================================================');
  console.log('Deploying Phunkquidity (Upgradeable Proxy)');
  console.log(`  Signer:   ${signer.address}`);
  console.log(`  Treasury: ${treasuryAddress}`);
  console.log('=====================================================================');

  const Factory = await hre.ethers.getContractFactory('Phunkquidity');

  const proxy = await upgrades.deployProxy(Factory, [treasuryAddress], {
    initializer: 'initialize',
    kind: 'transparent',
  });
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Proxy:          ${proxyAddress}`);
  console.log(`  Implementation: ${implAddress}`);
  console.log(`  Proxy Admin:    ${adminAddress}`);
  console.log(`=====================================================================`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${implAddress}`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
