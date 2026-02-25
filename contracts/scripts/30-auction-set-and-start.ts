import hre from 'hardhat';

const AUCTION_ADDRESS = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Using account:', signer.address);

  const auction = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION_ADDRESS, signer);

  // 1. Set duration to 30 minutes (1800 seconds)
  console.log('\nSetting duration to 30 minutes...');
  const tx1 = await auction.setDuration(1800);
  await tx1.wait();
  console.log('Duration set. TX:', tx1.hash);

  // 2. Set reserve price to 0.00001 ETH
  const reserve = hre.ethers.parseEther('0.00001');
  console.log('Setting reserve price to 0.00001 ETH...');
  const tx2 = await auction.setReservePrice(reserve);
  await tx2.wait();
  console.log('Reserve price set. TX:', tx2.hash);

  // 3. Settle current + create new auction
  console.log('Calling settleAndCreate()...');
  const tx3 = await auction.settleAndCreate();
  await tx3.wait();
  console.log('settleAndCreate done. TX:', tx3.hash);

  console.log('\nDone! New auction started with 30min duration, 0.00001 ETH reserve.');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
