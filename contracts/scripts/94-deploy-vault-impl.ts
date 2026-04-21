import hre from 'hardhat';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Deploying new CryptoPhunksVault implementation...');
  console.log('Signer:', signer.address);

  const Factory = await hre.ethers.getContractFactory('CryptoPhunksVault');
  const impl = await Factory.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();

  console.log('\n=====================================================================');
  console.log('New implementation deployed:', implAddress);
  console.log('=====================================================================');
  console.log('\nFrom 0x19d57A31... on Etherscan:');
  console.log('Proxy admin: https://etherscan.io/address/0x1B9e28ADC91f46256eDa055eAC743fda343A978e#writeContract');
  console.log('  Call upgradeAndCall:');
  console.log('    proxy: 0xB69d359Eaf0db03372a587d9dB6f75B0A92CB218');
  console.log('    implementation:', implAddress);
  console.log('    data: 0x');
  console.log('\nVerify: npx hardhat verify --network mainnet', implAddress);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
