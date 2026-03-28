import hre, { upgrades } from 'hardhat';

async function main() {
  const PROXY = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';

  console.log('Upgrading...');
  const Factory = await hre.ethers.getContractFactory('EthsRocksV2');
  await upgrades.upgradeProxy(PROXY, Factory, { unsafeSkipStorageCheck: true });
  const impl = await upgrades.erc1967.getImplementationAddress(PROXY);
  console.log('New impl:', impl);
  console.log('Verify:', `npx hardhat verify --network mainnet ${impl}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
