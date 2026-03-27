import hre from 'hardhat';

const auctionAddress = '0xc1fa86b53e8e101c93c570f276bc5177832bd031';
// Use one of the withdrawn rocks
const testHashId = '0x0e1094cf7decc748b0029a64e6dcd3f19c5416e822319debd2532607793d9209';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const auction = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', auctionAddress, signer);

  console.log('Signer:', signer.address);
  console.log('Reserve price:', hre.ethers.formatEther(await auction.reservePrice()), 'ETH');
  console.log('Pool size before:', Number(await auction.poolSize()));

  // Step 1: Deposit hashId into auction pool (send as calldata to fallback)
  console.log('\nDepositing rock into auction pool...');
  const depositTx = await signer.sendTransaction({
    to: auctionAddress,
    data: testHashId,
  });
  console.log('Deposit TX:', depositTx.hash);
  await depositTx.wait();
  console.log('Pool size after deposit:', Number(await auction.poolSize()));

  // Step 2: Settle any existing auction + create new one
  console.log('\nCalling settleAndCreate...');
  const tx = await auction.settleAndCreate();
  console.log('TX:', tx.hash);
  const receipt = await tx.wait();
  console.log('Confirmed in block', receipt!.blockNumber);

  // Check auction state
  const a = await auction.auction();
  console.log('\n=== New Auction ===');
  console.log('hashId:', a.hashId);
  console.log('auctionId:', Number(a.auctionId));
  console.log('startTime:', new Date(Number(a.startTime) * 1000).toISOString());
  console.log('endTime:', new Date(Number(a.endTime) * 1000).toISOString());
  console.log('amount:', hre.ethers.formatEther(a.amount), 'ETH');
  console.log('settled:', a.settled);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
