import hre, { upgrades } from 'hardhat';

const PROXY_ADDRESS = '0x2132622FF3178EF2574aF25D8EFdf94D6b7cc630'; // Auction House Pro

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('Upgrading auction proxy with ordered-queue support...');
  console.log('Signer:', signer.address);
  console.log('Proxy:', PROXY_ADDRESS);

  const Factory = await hre.ethers.getContractFactory('EtherPhunksAuctionHouseV2');

  // Register proxy in local OZ manifest if not already known
  try {
    await upgrades.forceImport(PROXY_ADDRESS, Factory, { kind: 'transparent' });
    console.log('Proxy imported into manifest.');
  } catch (e: any) {
    if (!e.message?.includes('already registered')) throw e;
    console.log('Proxy already in manifest.');
  }

  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, Factory);
  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  const adminAddress = await upgrades.erc1967.getAdminAddress(PROXY_ADDRESS);

  console.log('Upgrade complete.');
  console.log('Proxy:', PROXY_ADDRESS);
  console.log('Implementation:', implAddress);
  console.log('ProxyAdmin:', adminAddress);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
