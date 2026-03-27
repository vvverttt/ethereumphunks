import hre from 'hardhat';

const AUCTION_HOUSE = '0xc1fa86b53e8e101c93c570f276bc5177832bd031';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION_HOUSE, signer);

  const poolSize = await contract.poolSize();
  console.log('Auction house pool size:', poolSize.toString());

  if (poolSize === 0n) { console.log('Pool is empty.'); return; }

  const items = await contract.getPoolItems(0, poolSize);
  console.log('\nAll hashIds in pool:');
  items.forEach((h: string, i: number) => console.log(`  [${i}] ${h}`));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
