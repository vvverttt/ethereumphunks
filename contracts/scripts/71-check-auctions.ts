import hre from 'hardhat';

const AUCTION_ADDRESS = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';
const TARGET_RESERVE = hre.ethers.parseEther('0.67');

async function main() {
  const contract = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION_ADDRESS);

  // Global reserve price
  const globalReserve = await contract.reservePrice();
  console.log(`Global reservePrice: ${hre.ethers.formatEther(globalReserve)} ETH ${globalReserve === TARGET_RESERVE ? '✅' : '❌'}`);

  // Current active auction
  const activeAuction = await contract.auction();
  console.log(`\nActive auction: hashId=${activeAuction.hashId.slice(0,18)}... settled=${activeAuction.settled}`);
  if (activeAuction.hashId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
    const itemRes = await contract.itemReservePrice(activeAuction.hashId);
    const effectiveRes = itemRes > 0n ? itemRes : globalReserve;
    const correct = effectiveRes === TARGET_RESERVE;
    console.log(`  itemReservePrice=${hre.ethers.formatEther(itemRes)} ETH → effective=${hre.ethers.formatEther(effectiveRes)} ETH ${correct ? '✅' : '❌'}`);
  }

  // Pool items
  const poolSize = await contract.poolSize();
  console.log(`\nPool size: ${poolSize}`);
  console.log(`Target reserve: 0.67 ETH\n`);

  let wrongReserve = 0;
  const items = await contract.getPoolItems(0, poolSize);
  for (const hashId of items) {
    const itemRes = await contract.itemReservePrice(hashId);
    const effectiveRes = itemRes > 0n ? itemRes : globalReserve;
    const correct = effectiveRes === TARGET_RESERVE;
    if (!correct) wrongReserve++;
    console.log(
      `Pool item ${hashId.slice(0,18)}...: itemReserve=${hre.ethers.formatEther(itemRes)}ETH effective=${hre.ethers.formatEther(effectiveRes)}ETH ${correct ? '✅' : '❌'}`
    );
  }

  console.log(wrongReserve === 0 ? '\nAll items have 0.67 ETH effective reserve ✅' : `\n${wrongReserve} items have wrong reserve ❌`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
