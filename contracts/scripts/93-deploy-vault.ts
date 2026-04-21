import hre, { upgrades } from 'hardhat';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const treasuryAddress = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

  console.log('\n=====================================================================');
  console.log('Deploying CryptoPhunksVault (Upgradeable Proxy)');
  console.log(`  Signer:   ${signer.address}`);
  console.log(`  Treasury: ${treasuryAddress}`);
  console.log('=====================================================================');

  const Factory = await hre.ethers.getContractFactory('CryptoPhunksVault');

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
  console.log(`\nNext steps:`);
  console.log(`  1. Transfer proxy admin to ${treasuryAddress}`);
  console.log(`  2. Transfer ownership to ${treasuryAddress}`);
  console.log(`  3. Set Merkle root: setMerkleRoot(0xc52b5af6c3681ccad3e954fdb73af906f5e36ee3c4af8c88bb8f1b176e922ba6)`);
  console.log(`  4. Deposit spare v67 items`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
