import hre from 'hardhat';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8');
  const tx = await contract.resetTotalSwapped(0);
  await tx.wait();
  console.log('TX:', tx.hash);
  console.log('totalSwapped:', (await contract.totalSwapped()).toString());
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
