import hre from 'hardhat';

const AUCTION_ADDRESS = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';

// Original reserve prices (ETH) — keyed by hashId prefix for matching
const ORIGINALS: Record<string, string> = {
  '0x8b910893': '4.69',
  '0xa0857574': '5.0',
  '0xd12f46c6': '6.7',
  '0x930cb796': '9.5',
  '0x348e8fe2': '2.56',
  '0x6577bb3a': '1.0',
  '0xe63e2e8d': '67.0',
};

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION_ADDRESS, signer);

  const poolSize = await contract.poolSize();
  const poolItems: string[] = await contract.getPoolItems(0, poolSize);
  const activeAuction = await contract.auction();
  const allItems: string[] = [];
  if (activeAuction.startTime > 0n && !activeAuction.settled) allItems.push(activeAuction.hashId);
  allItems.push(...poolItems);

  const hashIds: string[] = [];
  const prices: bigint[] = [];

  for (const hashId of allItems) {
    const prefix = hashId.slice(0, 10);
    if (ORIGINALS[prefix]) {
      hashIds.push(hashId);
      prices.push(hre.ethers.parseEther(ORIGINALS[prefix]));
      console.log(`  ${hashId.slice(0, 20)}...: restore to ${ORIGINALS[prefix]} ETH`);
    }
  }

  if (hashIds.length === 0) {
    console.log('No matching items found in pool');
    return;
  }

  console.log(`\nRestoring ${hashIds.length} items...`);
  const tx = await contract.setItemReservePrices(hashIds, prices);
  const receipt = await tx.wait();
  console.log(`TX: ${receipt?.hash} status=${receipt?.status}`);
  console.log('Done ✅');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
