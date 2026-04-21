import hre from 'hardhat';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8');

  const poolSize = await contract.poolSize();
  console.log('Current pool size:', poolSize.toString());

  const target = 67;
  const toRemove = Number(poolSize) - target;
  if (toRemove <= 0) {
    console.log('Already at or below 67');
    return;
  }

  console.log(`Removing ${toRemove} rocks from pool...`);

  // Get the last N items from pool
  const items = await contract.getPoolItems(BigInt(target), BigInt(toRemove));
  console.log(`Got ${items.length} items to withdraw`);

  // Withdraw in batch (convert to mutable array)
  const hashIds = [...items];
  const tx = await contract.withdrawFromPoolBatch(hashIds);
  await tx.wait();
  console.log('TX:', tx.hash);

  const newSize = await contract.poolSize();
  console.log('New pool size:', newSize.toString());
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
