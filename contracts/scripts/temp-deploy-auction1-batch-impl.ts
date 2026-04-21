import hre from 'hardhat';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Deploying new EtherPhunksAuctionHouseV2 implementation (with batch emergency withdraw)...');
  console.log('Signer:', signer.address);

  const Factory = await hre.ethers.getContractFactory('EtherPhunksAuctionHouseV2');
  const impl = await Factory.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();

  console.log('\n=====================================================================');
  console.log('New implementation:', implAddress);
  console.log('=====================================================================');
  console.log('\nFrom 0x19d57A31... on Etherscan:');
  console.log('Auction 1 Proxy admin: https://etherscan.io/address/0xd043f41f07e7bc140e51971f7dd3c33ab35508ad#writeContract');
  console.log('  Call upgradeAndCall:');
  console.log('    proxy: 0xc1fA86b53e8e101c93c570f276bC5177832bd031');
  console.log('    implementation:', implAddress);
  console.log('    data: 0x');
  console.log('\nAlso upgrade Auction 2 (same impl):');
  console.log('  proxy admin: 0x4a00C37781939ea4E1B38a19A12819270ea36A0a');
  console.log('  proxy: 0x2132622FF3178EF2574aF25D8EFdf94D6b7cc630');
  console.log('  implementation:', implAddress);
  console.log('\nVerify: npx hardhat verify --network mainnet', implAddress);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
