import hre from 'hardhat';

const proxyAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt('EthsRocksV2', proxyAddress, signer);

  const poolSize = await contract.poolSize();
  console.log('Pool size:', Number(poolSize));

  if (poolSize === 0n) {
    console.log('Pool is empty, nothing to withdraw.');
    return;
  }

  // Get all pool items (spread to make mutable copy)
  const items = [...await contract.getPoolItems(0, poolSize)];
  console.log('Retrieved', items.length, 'hashIds');

  // Split into batches of 25 to stay well within gas limits
  const BATCH_SIZE = 25;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = [...items.slice(i, i + BATCH_SIZE)];
    console.log(`\nWithdrawing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items)...`);
    const tx = await contract.withdrawFromPoolBatch(batch);
    console.log('TX:', tx.hash);
    const receipt = await tx.wait();
    console.log('Confirmed in block', receipt!.blockNumber, '- gas used:', receipt!.gasUsed.toString());
  }

  const remaining = await contract.poolSize();
  console.log('\n=== Done! Pool size now:', Number(remaining), '===');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
