import hre from 'hardhat';
import { createClient } from '@supabase/supabase-js';

const AUCTION = '0xc1fa86b53e8e101c93c570f276bc5177832bd031';
const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

async function main() {
  const auction = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION);

  // Active auction
  const current = await auction.auction();

  // Pool items
  const poolSize = Number(await auction.poolSize());
  const poolItems = [...await auction.getPoolItems(0, poolSize)];

  // All hashIds
  const allHashIds = [current.hashId, ...poolItems];

  // Lookup tokenIds from DB
  const { data: dbItems } = await supabase
    .from('ethscriptions')
    .select('hashId,tokenId')
    .in('hashId', allHashIds.map(h => h.toLowerCase()));

  const tokenMap: Record<string, number> = {};
  for (const item of dbItems || []) tokenMap[item.hashId.toLowerCase()] = item.tokenId;

  // Get reserves
  const results: { tokenId: number; reserve: string; reserveNum: number; isActive: boolean }[] = [];
  for (const hashId of allHashIds) {
    const r = await auction.itemReservePrice(hashId);
    results.push({
      tokenId: tokenMap[hashId.toLowerCase()] || 0,
      reserve: hre.ethers.formatEther(r),
      reserveNum: Number(hre.ethers.formatEther(r)),
      isActive: hashId === current.hashId,
    });
  }

  results.sort((a, b) => a.tokenId - b.tokenId);

  console.log('Token  | Reserve        | Status');
  console.log('-------|----------------|-------');
  for (const r of results) {
    const status = r.isActive ? ' << ACTIVE' : '';
    console.log(`#${String(r.tokenId).padEnd(6)}| ${(r.reserve + ' ETH').padEnd(15)}|${status}`);
  }
  console.log(`\nTotal: ${results.length} items (1 active + ${poolSize} in pool)`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
