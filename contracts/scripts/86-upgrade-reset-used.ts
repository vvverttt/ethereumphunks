import hre, { upgrades } from 'hardhat';

const PROXY = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
const CALLER = '0x436196aB0550E73AEEdd1a494C2420DAcA7Fe0Ca';

const hashes = [
  '0x309c24278537c4337d93f96e287ba1bca820ecbb53799d32236847a261d1ed3b',
  '0x0a9c1c695d9e20bfeab770dc4b50b5d2fcc59aa489f6fc8b450e8ef2b5c8386b',
  '0x3a17681a2075a204a9ee8fb47edbddac5bbcd73ddce4efc3cd84dbbe837fc8f4',
  '0x6fc2dc9f8166a368a4f9e2f2696810f2acecbfb3607c4140c7b0158275f1943c',
  '0x032793ffe8fb83318544ebda6123734da3982b2be42086be7666124c605d7efb',
];

async function main() {
  // Upgrade
  console.log('Upgrading...');
  const Factory = await hre.ethers.getContractFactory('EthsRocksV2');
  await upgrades.upgradeProxy(PROXY, Factory, { unsafeSkipStorageCheck: true });
  const impl = await upgrades.erc1967.getImplementationAddress(PROXY);
  console.log('New impl:', impl);

  const contract = await hre.ethers.getContractAt('EthsRocksV2', PROXY);

  // Reset used flags
  console.log('Resetting used flags...');
  const tx = await contract.resetUsedBatchEthscriptions(hashes);
  await tx.wait();
  console.log('TX:', tx.hash);

  // Also return the deposit for the one that's not deposited (0x0327...)
  // and re-deposit from the right wallet
  const dep = await contract.userEthscriptionPossiblyStored(CALLER, hashes[4]);
  console.log('0x0327... deposited by 0x4361:', dep);

  // Verify
  for (const h of hashes) {
    const used = await contract.usedBatchEthscription(h);
    console.log(h.slice(0, 10), 'used:', used);
  }

  console.log('\nVerify:', `npx hardhat verify --network mainnet ${impl}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
