import hre from 'hardhat';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8');

  const pool = await contract.poolSize();
  const swapped = await contract.totalSwapped();
  const swapEnabled = await contract.swapEnabled();
  const paused = await contract.paused();

  console.log('Pool size:', pool.toString());
  console.log('Total swapped:', swapped.toString());
  console.log('Swap enabled:', swapEnabled);
  console.log('Paused:', paused);

  // Check recent events
  const provider = hre.ethers.provider;
  const block = await provider.getBlockNumber();
  console.log('\nCurrent block:', block);

  // Check RockSwapped events
  const swapFilter = contract.filters.RockSwapped();
  const swapEvents = await contract.queryFilter(swapFilter, block - 1000);
  console.log('\nRockSwapped events:', swapEvents.length);
  for (const e of swapEvents) {
    console.log(`  Block ${e.blockNumber}: swapper=${(e as any).args.swapper} rock=${(e as any).args.hashId.slice(0,10)}...`);
  }

  // Check PoolDeposited events recently
  const depositFilter = contract.filters.PoolDeposited();
  const depositEvents = await contract.queryFilter(depositFilter, block - 100);
  console.log('\nRecent PoolDeposited events:', depositEvents.length);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
