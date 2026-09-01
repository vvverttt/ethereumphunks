// Check who has sold, listed, or escrowed any OG Missing Phunks / OG DystoPhunks
// and who has NOT done any of that (diamond hands)

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = (process.env.SUPABASE_KEY || '');

const MARKET = '0xa48a43186612b179c0bc68ea34b4932549a70bfa';
const OLD_MARKET = '0xd3418772623be1a3cc6b6d45cb46420cedd9154a';
const OG_SLUGS = ['og-missing-phunks', 'og-dysto-phunks'];

async function query(table, params) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
}

async function main() {
  // Track wallets
  const soldOrListed = new Map(); // wallet -> reasons[]
  const allOwners = new Map(); // wallet -> [{slug, tokenId}]

  for (const slug of OG_SLUGS) {
    // Get all items in collection
    const items = await query('ethscriptions', {
      select: 'hashId,tokenId,owner,prevOwner',
      slug: `eq.${slug}`,
      limit: '10000',
    });
    console.log(`\n=== ${slug}: ${items.length} items ===`);

    // Build owner map (true owner considering escrow)
    for (const item of items) {
      const isEscrowed = (item.owner === MARKET || item.owner === OLD_MARKET);
      const trueOwner = isEscrowed ? item.prevOwner?.toLowerCase() : item.owner?.toLowerCase();
      if (!trueOwner) continue;
      if (!allOwners.has(trueOwner)) allOwners.set(trueOwner, []);
      allOwners.get(trueOwner).push({ slug, tokenId: item.tokenId, escrowed: isEscrowed });
    }

    // Check active listings
    const batchSize = 20;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const hashIds = batch.map(b => b.hashId).join(',');
      const listings = await query('listings', {
        select: 'hashId,listedBy,minValue,listed',
        hashId: `in.(${hashIds})`,
        listed: 'eq.true',
      });
      for (const l of listings) {
        const item = items.find(x => x.hashId === l.hashId);
        const ethPrice = (Number(l.minValue) / 1e18).toFixed(4);
        const w = l.listedBy.toLowerCase();
        if (!soldOrListed.has(w)) soldOrListed.set(w, []);
        soldOrListed.get(w).push(`LISTED ${slug} #${item?.tokenId} at ${ethPrice} ETH`);
      }
    }

    // Check escrow (owner = market contract, prevOwner = real owner)
    for (const item of items) {
      if (item.owner === MARKET || item.owner === OLD_MARKET) {
        const w = item.prevOwner?.toLowerCase();
        if (!w) continue;
        if (!soldOrListed.has(w)) soldOrListed.set(w, []);
        // Avoid duplicate with listing
        const existing = soldOrListed.get(w);
        if (!existing.some(r => r.includes(`#${item.tokenId}`) && r.startsWith('LISTED'))) {
          existing.push(`ESCROWED ${slug} #${item.tokenId} (in marketplace contract)`);
        }
      }
    }

    // Check sales (PhunkBought, sale events)
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const hashIds = batch.map(b => b.hashId).join(',');
      const sales = await query('events', {
        select: 'hashId,from,to,value,type,blockTimestamp',
        hashId: `in.(${hashIds})`,
        type: `in.(PhunkBought,sale)`,
        order: 'blockTimestamp.desc',
        limit: '500',
      });
      for (const s of sales) {
        const item = items.find(x => x.hashId === s.hashId);
        const ethPrice = s.value ? (Number(s.value) / 1e18).toFixed(4) : '?';
        if (s.from) {
          const w = s.from.toLowerCase();
          if (!soldOrListed.has(w)) soldOrListed.set(w, []);
          soldOrListed.get(w).push(`SOLD ${slug} #${item?.tokenId} for ${ethPrice} ETH (${s.blockTimestamp?.slice(0,10)})`);
        }
      }
    }
  }

  // Results
  console.log(`\n\n========================================`);
  console.log(`=== WALLETS THAT SOLD / LISTED / ESCROWED ===`);
  console.log(`========================================\n`);

  const sortedActive = [...soldOrListed.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [wallet, reasons] of sortedActive) {
    console.log(wallet);
    for (const r of reasons) console.log(`    ${r}`);
  }
  console.log(`\nTotal: ${sortedActive.length} wallets\n`);

  console.log(`========================================`);
  console.log(`=== DIAMOND HANDS (never sold/listed/escrowed) ===`);
  console.log(`========================================\n`);

  // Exclude contract addresses themselves
  const contracts = new Set([MARKET, OLD_MARKET]);
  const diamondHands = [...allOwners.entries()]
    .filter(([w]) => !soldOrListed.has(w) && !contracts.has(w))
    .sort((a, b) => b[1].length - a[1].length); // sort by # held desc

  for (const [wallet, holdings] of diamondHands) {
    const missing = holdings.filter(h => h.slug === 'og-missing-phunks').length;
    const dysto = holdings.filter(h => h.slug === 'og-dysto-phunks').length;
    const parts = [];
    if (missing) parts.push(`${missing} missing`);
    if (dysto) parts.push(`${dysto} dysto`);
    console.log(`${wallet}  (${parts.join(', ')})`);
  }
  console.log(`\nTotal diamond hands: ${diamondHands.length} wallets`);
  console.log(`Total active wallets (sold/listed): ${sortedActive.length} wallets`);
}

main().catch(console.error);
