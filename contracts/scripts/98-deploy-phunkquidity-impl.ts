import hre, { ethers } from 'hardhat';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log(`Signer: ${signer.address}`);

  console.log('\nDeploying new Phunkquidity implementation...');
  const Factory = await ethers.getContractFactory('Phunkquidity');
  const impl = await Factory.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();

  console.log(`\n✓ New implementation deployed: ${implAddress}`);
  console.log(`\nNext step: treasury wallet must call upgradeAndCall on ProxyAdmin`);
  console.log(`  ProxyAdmin: 0x449b1B1bf25F4e76AEDef971A790bd84aa351235`);
  console.log(`  Proxy:      0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A`);
  console.log(`  New impl:   ${implAddress}`);
  console.log(`  data:       0x`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${implAddress}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
