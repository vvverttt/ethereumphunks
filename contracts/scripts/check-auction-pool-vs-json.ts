import hre from 'hardhat';
import * as fs from 'fs';

const AUCTION = '0xc1fa86b53e8e101c93c570f276bc5177832bd031';
const JSON_FILE = 'C:/Users/alber/OneDrive/Desktop/market/cryptophunksv67_updatedcompleteeeeeeeeeeeeee.json';

async function main() {
  const raw = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  const jsonHashIds = new Set(raw.collection_items.map((item: any) => item.id.toLowerCase()));

  const [signer] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION, signer);

  const poolSize: bigint = await contract.poolSize();
  console.log('Auction pool size:', poolSize.toString());

  if (poolSize === 0n) { console.log('Pool is empty — nothing to check.'); return; }

  const items: string[] = await contract.getPoolItems(0, poolSize);
  const invalid = items.filter(h => !jsonHashIds.has(h.toLowerCase()));
  console.log(`Pool items: ${items.length}, NOT in JSON: ${invalid.length}`);
  if (invalid.length > 0) invalid.forEach(h => console.log(' ', h));
  else console.log('All clean ✅');

  // Also check current auction hashId
  const auction = await contract.auction();
  const auctionInJson = jsonHashIds.has(auction.hashId.toLowerCase());
  console.log(`\nCurrent auction hashId in JSON: ${auctionInJson ? 'YES ✅' : 'NO ❌'}`);
  console.log('hashId:', auction.hashId);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
