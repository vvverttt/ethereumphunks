import hre from 'hardhat';

async function main() {
  const market = await hre.ethers.getContractAt('EtherPhunksMarket', '0xa48a43186612B179C0bc68Ea34B4932549a70BfA');

  // Check current royalties
  const totalBps = await market.totalRoyaltyBps();
  console.log('Current total royalty bps:', totalBps.toString(), '(' + (Number(totalBps) / 100) + '%)');

  // Set to zero - empty arrays
  console.log('Setting royalties to 0...');
  const tx = await market.setRoyaltyShares([], []);
  await tx.wait();
  console.log('TX:', tx.hash);

  const newBps = await market.totalRoyaltyBps();
  console.log('New total royalty bps:', newBps.toString(), '(' + (Number(newBps) / 100) + '%)');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
