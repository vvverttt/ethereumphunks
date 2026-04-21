import hre from 'hardhat';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Deploying new EtherPhunksAuctionHouseV2 implementation (with swap)...');
  console.log('Signer:', signer.address);

  const Factory = await hre.ethers.getContractFactory('EtherPhunksAuctionHouseV2');
  const impl = await Factory.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();

  console.log('\n=====================================================================');
  console.log('New implementation deployed:', implAddress);
  console.log('=====================================================================');
  console.log('\nFrom 0x19d57A31... on Etherscan:');
  console.log('Proxy admin: https://etherscan.io/address/0x4a00C37781939ea4E1B38a19A12819270ea36A0a#writeContract');
  console.log('  Call upgradeAndCall:');
  console.log('    proxy: 0x2132622FF3178EF2574aF25D8EFdf94D6b7cc630');
  console.log('    implementation:', implAddress);
  console.log('    data: 0x');
  console.log('\nThen set up swap:');
  console.log('  1. setSwapEnabled(true)');
  console.log('  2. setSwapMerkleRoot(0xc52b5af6c3681ccad3e954fdb73af906f5e36ee3c4af8c88bb8f1b176e922ba6)');
  console.log('\nVerify: npx hardhat verify --network mainnet', implAddress);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
