import hre from 'hardhat';

const AUCTION_ADDRESS = '0x2132622FF3178EF2574aF25D8EFdf94D6b7cc630'; // Auction House Pro

// Replace these with the exact hashIds you want auctioned in order.
const ORDERED_HASH_IDS: string[] = [
  // '0x...',
  // '0x...',
];

async function main() {
  if (ORDERED_HASH_IDS.length === 0) {
    throw new Error('Add at least one hashId to ORDERED_HASH_IDS before running this script.');
  }

  const [signer] = await hre.ethers.getSigners();
  console.log('Using account:', signer.address);

  const auction = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION_ADDRESS, signer);

  console.log(`Setting ordered auction queue with ${ORDERED_HASH_IDS.length} items...`);
  const tx = await auction.setAuctionOrder(ORDERED_HASH_IDS);
  await tx.wait();

  const remaining = await auction.auctionOrderSize();
  const items = await auction.getAuctionOrderItems();

  console.log('Done. TX:', tx.hash);
  console.log('Remaining ordered items:', remaining.toString());
  console.log('Queue:', items);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
