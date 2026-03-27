import hre from 'hardhat';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8');

  const before = await contract.swapEnabled();
  console.log('Swap enabled before:', before);

  const tx = await contract.setSwapEnabled(true);
  await tx.wait();
  console.log('TX:', tx.hash);

  const after = await contract.swapEnabled();
  console.log('Swap enabled after:', after);

  const pool = await contract.poolSize();
  console.log('Pool size:', pool.toString());
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
