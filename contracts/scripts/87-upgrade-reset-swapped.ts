import hre, { upgrades } from 'hardhat';

async function main() {
  const PROXY = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';

  console.log('Upgrading...');
  const Factory = await hre.ethers.getContractFactory('EthsRocksV2');
  await upgrades.upgradeProxy(PROXY, Factory, { unsafeSkipStorageCheck: true });
  const impl = await upgrades.erc1967.getImplementationAddress(PROXY);
  console.log('New impl:', impl);

  const contract = await hre.ethers.getContractAt('EthsRocksV2', PROXY);

  console.log('Setting totalSwapped to 0...');
  const tx = await contract.resetTotalSwapped(0);
  await tx.wait();
  console.log('TX:', tx.hash);

  console.log('totalSwapped:', (await contract.totalSwapped()).toString());
  console.log('pool:', (await contract.poolSize()).toString());
  console.log('\nVerify:', `npx hardhat verify --network mainnet ${impl}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
