import hre from 'hardhat';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Deploying implementation only...');
  console.log('Signer:', signer.address);

  const Factory = await hre.ethers.getContractFactory('EtherPhunksAuctionHouseV2');
  const impl = await Factory.deploy();
  await impl.waitForDeployment();

  const implAddress = await impl.getAddress();
  console.log('New implementation deployed at:', implAddress);
  console.log('');
  console.log('Now call on ProxyAdmin (0xd043f41f07e7bc140e51971f7dd3c33ab35508ad):');
  console.log('  upgrade(0xc1fA86b53e8e101c93c570f276bC5177832bd031,', implAddress + ')');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
