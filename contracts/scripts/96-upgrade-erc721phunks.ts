import { ethers, upgrades } from 'hardhat';

const PROXY = '0x9833b60234424e1DAAC8883D3F52c16093563BBF';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Upgrader:', deployer.address);

  const Factory = await ethers.getContractFactory('ERC721PhunksV67');
  const upgraded = await upgrades.upgradeProxy(PROXY, Factory);
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY);
  console.log('✅  Proxy:           ', PROXY);
  console.log('✅  New impl:        ', newImpl);
}

main().catch(err => { console.error(err); process.exit(1); });
