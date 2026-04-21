import hre from 'hardhat';
import { createClient } from '@supabase/supabase-js';

const AUCTION = '0xc1fa86b53e8e101c93c570f276bc5177832bd031';
const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

// tokenId → reserve in ETH
const updates: Record<number, string> = {
  446: '6.7',
  723: '6.7',
  883: '6.7',
  3460: '6.7',
  4335: '6.7',
  5034: '6.7',
  6134: '6.7',
  7201: '6.7',
  8274: '6.7',
  9697: '6.7',
};

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const auction = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION, signer);

  // Get all pool + active hashIds
  const current = await auction.auction();
  const poolSize = Number(await auction.poolSize());
  const poolItems = [...await auction.getPoolItems(0, poolSize)];
  const allHashIds = [current.hashId, ...poolItems];

  // Lookup tokenIds from DB
  const { data: dbItems } = await supabase
    .from('ethscriptions')
    .select('hashId,tokenId')
    .in('hashId', allHashIds.map(h => h.toLowerCase()));

  // Build tokenId → hashId map
  const tokenToHash: Record<number, string> = {};
  for (const item of dbItems || []) {
    tokenToHash[item.tokenId] = allHashIds.find(h => h.toLowerCase() === item.hashId.toLowerCase())!;
  }

  // Build arrays for setItemReservePrices
  const hashIds: string[] = [];
  const prices: bigint[] = [];

  for (const [tokenId, ethPrice] of Object.entries(updates)) {
    const hash = tokenToHash[Number(tokenId)];
    if (!hash) {
      console.log(`WARNING: Token #${tokenId} not found in auction pool!`);
      continue;
    }
    hashIds.push(hash);
    prices.push(hre.ethers.parseEther(ethPrice));
    console.log(`#${tokenId} → ${ethPrice} ETH (${hash.slice(0, 10)}...)`);
  }

  if (hashIds.length === 0) {
    console.log('Nothing to update');
    return;
  }

  console.log(`\nSetting ${hashIds.length} reserve prices...`);
  const tx = await auction.setItemReservePrices(hashIds, prices);
  console.log('TX:', tx.hash);
  await tx.wait();
  console.log('Done!');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
