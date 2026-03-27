import hre from 'hardhat';

const AUCTION_ADDRESS = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';
const TARGET_RESERVE = hre.ethers.parseEther('0.67');

const ABI_FRAGMENTS = [
  'function poolSize() view returns (uint256)',
  'function getPoolItems(uint256 offset, uint256 limit) view returns (bytes32[])',
  'function auction() view returns (bytes32 hashId, uint256 amount, uint256 startTime, uint256 endTime, address bidder, bool settled, uint256 auctionId)',
  'function itemReservePrice(bytes32) view returns (uint256)',
  'function setItemReservePrices(bytes32[] calldata hashIds, uint256[] calldata prices)',
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION_ADDRESS, signer);

  const poolSize = await contract.poolSize();
  const poolItems: string[] = await contract.getPoolItems(0, poolSize);
  const activeAuction = await contract.auction();

  const allItems: string[] = [];
  if (activeAuction.startTime > 0n && !activeAuction.settled) allItems.push(activeAuction.hashId);
  allItems.push(...poolItems);

  console.log(`Checking ${allItems.length} items...\n`);

  const needsUpdate: string[] = [];
  for (const hashId of allItems) {
    const res = await contract.itemReservePrice(hashId);
    // Only flag items with NO reserve set (0) — don't touch custom reserves
    const unset = res === 0n;
    console.log(`${hashId.slice(0,20)}...: ${hre.ethers.formatEther(res)} ETH ${unset ? '❌ UNSET' : '✅'}`);
    if (unset) needsUpdate.push(hashId);
  }

  if (needsUpdate.length === 0) {
    console.log('\nAll items already at 0.67 ETH ✅');
    return;
  }

  console.log(`\nSetting ${needsUpdate.length} unset items to 0.67 ETH default...`);
  const prices = needsUpdate.map(() => TARGET_RESERVE);
  const tx = await contract.setItemReservePrices(needsUpdate, prices);
  const receipt = await tx.wait();
  console.log(`TX: ${receipt?.hash} status=${receipt?.status}`);
  console.log(`Done ✅`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
