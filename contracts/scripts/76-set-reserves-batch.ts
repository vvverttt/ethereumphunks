import hre from 'hardhat';

const AUCTION_ADDRESS = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';

// All 14 items → 67 ETH reserve
const TOKEN_IDS_67: number[] = [244, 446, 723, 883, 1884, 3460, 4335, 4960, 5034, 5614, 6134, 7201, 8274, 9697];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION_ADDRESS, signer);

  // Get all pool items + active auction
  const poolSize = await contract.poolSize();
  const poolItems: string[] = await contract.getPoolItems(0, poolSize);
  const activeAuction = await contract.auction();
  const allItems: string[] = [];
  if (activeAuction.startTime > 0n && !activeAuction.settled) allItems.push(activeAuction.hashId);
  allItems.push(...poolItems);

  console.log(`Total items in auction: ${allItems.length}`);

  // We need to resolve tokenIds to hashIds via supabase
  const { createClient } = await import('@supabase/supabase-js');
  const sb = (createClient as any)(
    'https://hzpwkpjxhtpcygrwtwku.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
  );

  const { data: tokens } = await sb
    .from('ethscriptions')
    .select('hashId, tokenId')
    .in('hashId', allItems)
    .in('tokenId', TOKEN_IDS_67);

  if (!tokens || tokens.length === 0) {
    console.log('No matching tokens found!');
    return;
  }

  const hashIds: string[] = [];
  const prices: bigint[] = [];
  const reserve = hre.ethers.parseEther('67.0');

  tokens.sort((a: any, b: any) => a.tokenId - b.tokenId);
  for (const t of tokens) {
    hashIds.push(t.hashId);
    prices.push(reserve);
    console.log(`  #${t.tokenId}: ${t.hashId.slice(0, 20)}... → 67 ETH`);
  }

  const missing = TOKEN_IDS_67.filter(id => !tokens.find((t: any) => t.tokenId === id));
  if (missing.length > 0) {
    console.log(`\nWARNING: Missing tokenIds not found in pool: ${missing.join(', ')}`);
  }

  console.log(`\nSetting ${hashIds.length} items to 67 ETH...`);
  const tx = await contract.setItemReservePrices(hashIds, prices);
  const receipt = await tx.wait();
  console.log(`TX: ${receipt?.hash} status=${receipt?.status}`);

  // Verify
  console.log('\nVerifying...');
  for (const t of tokens) {
    const r = await contract.itemReservePrice(t.hashId);
    console.log(`  #${t.tokenId}: ${hre.ethers.formatEther(r)} ETH ${r === reserve ? '✅' : '❌'}`);
  }

  console.log('Done ✅');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
