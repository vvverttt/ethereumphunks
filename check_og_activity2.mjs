// Check diamond hands wallets for ANY activity across ALL collections
// (not just og-missing-phunks / og-dysto-phunks)

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
  // Step 1: Get all OG items and determine true owners
  const allOwners = new Map(); // wallet -> [{slug, tokenId}]
  const soldOrListedOG = new Set(); // wallets that sold/listed OG items

  for (const slug of OG_SLUGS) {
    const items = await query('ethscriptions', {
      select: 'hashId,tokenId,owner,prevOwner',
      slug: `eq.${slug}`,
      limit: '10000',
    });
    console.log(`${slug}: ${items.length} items`);

    for (const item of items) {
      const isEscrowed = (item.owner === MARKET || item.owner === OLD_MARKET);
      const trueOwner = isEscrowed ? item.prevOwner?.toLowerCase() : item.owner?.toLowerCase();
      if (!trueOwner) continue;
      if (!allOwners.has(trueOwner)) allOwners.set(trueOwner, []);
      allOwners.get(trueOwner).push({ slug, tokenId: item.tokenId, escrowed: isEscrowed });

      if (isEscrowed) soldOrListedOG.add(trueOwner);
    }

    // Check active listings
    const batchSize = 20;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const hashIds = batch.map(b => b.hashId).join(',');
      const listings = await query('listings', {
        select: 'hashId,listedBy',
        hashId: `in.(${hashIds})`,
        listed: 'eq.true',
      });
      for (const l of listings) soldOrListedOG.add(l.listedBy.toLowerCase());
    }

    // Check sales
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const hashIds = batch.map(b => b.hashId).join(',');
      const sales = await query('events', {
        select: 'from',
        hashId: `in.(${hashIds})`,
        type: `in.(PhunkBought,sale)`,
        limit: '500',
      });
      for (const s of sales) if (s.from) soldOrListedOG.add(s.from.toLowerCase());
    }
  }

  // Step 2: Filter diamond hands (never sold/listed OG items)
  const contracts = new Set([MARKET, OLD_MARKET]);
  const diamondHands = [...allOwners.entries()]
    .filter(([w]) => !soldOrListedOG.has(w) && !contracts.has(w))
    .map(([w, holdings]) => w);

  console.log(`\nDiamond hands (OG only): ${diamondHands.length} wallets`);
  console.log(`\nNow checking ALL their activity across every collection...\n`);

  // Step 3: For each diamond hand, check ALL their activity
  const walletActivity = new Map(); // wallet -> activity[]

  for (const wallet of diamondHands) {
    const activity = [];

    // Check if they own anything in escrow (any collection)
    const escrowed = await query('ethscriptions', {
      select: 'hashId,tokenId,slug,owner',
      prevOwner: `eq.${wallet}`,
      owner: `in.(${MARKET},${OLD_MARKET})`,
      limit: '100',
    });
    for (const e of escrowed) {
      activity.push(`ESCROWED ${e.slug} #${e.tokenId}`);
    }

    // Check if they have any active listings (any collection)
    const listings = await query('listings', {
      select: 'hashId,minValue',
      listedBy: `eq.${wallet}`,
      listed: 'eq.true',
      limit: '100',
    });
    for (const l of listings) {
      const ethPrice = (Number(l.minValue) / 1e18).toFixed(4);
      activity.push(`LISTED (hashId: ${l.hashId.slice(0,10)}...) at ${ethPrice} ETH`);
    }

    // Check if they sold anything (any collection) - PhunkBought or sale events
    const sales = await query('events', {
      select: 'hashId,value,type,blockTimestamp',
      from: `eq.${wallet}`,
      type: `in.(PhunkBought,sale)`,
      order: 'blockTimestamp.desc',
      limit: '100',
    });
    for (const s of sales) {
      const ethPrice = s.value ? (Number(s.value) / 1e18).toFixed(4) : '?';
      activity.push(`SOLD (hashId: ${s.hashId?.slice(0,10)}...) for ${ethPrice} ETH (${s.blockTimestamp?.slice(0,10)})`);
    }

    // Check PhunkOffered events (listed in past)
    const offers = await query('events', {
      select: 'hashId,value,blockTimestamp',
      from: `eq.${wallet}`,
      type: `eq.PhunkOffered`,
      limit: '100',
    });
    for (const o of offers) {
      const ethPrice = o.value ? (Number(o.value) / 1e18).toFixed(4) : '?';
      activity.push(`OFFERED (hashId: ${o.hashId?.slice(0,10)}...) at ${ethPrice} ETH (${o.blockTimestamp?.slice(0,10)})`);
    }

    if (activity.length > 0) {
      walletActivity.set(wallet, activity);
    }
  }

  // Results
  const holdings = (w) => {
    const h = allOwners.get(w) || [];
    const missing = h.filter(x => x.slug === 'og-missing-phunks').length;
    const dysto = h.filter(x => x.slug === 'og-dysto-phunks').length;
    const parts = [];
    if (missing) parts.push(`${missing} missing`);
    if (dysto) parts.push(`${dysto} dysto`);
    return parts.join(', ');
  };

  console.log(`========================================`);
  console.log(`=== DIAMOND HANDS WITH OTHER ACTIVITY ===`);
  console.log(`========================================\n`);

  const withActivity = [...walletActivity.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [wallet, acts] of withActivity) {
    console.log(`${wallet}  (OG: ${holdings(wallet)})`);
    for (const a of acts) console.log(`    ${a}`);
    console.log('');
  }
  console.log(`Total with other activity: ${withActivity.length}\n`);

  console.log(`========================================`);
  console.log(`=== TRUE DIAMOND HANDS (zero activity anywhere) ===`);
  console.log(`========================================\n`);

  const trueDiamondHands = diamondHands
    .filter(w => !walletActivity.has(w))
    .sort((a, b) => {
      const aH = allOwners.get(a)?.length || 0;
      const bH = allOwners.get(b)?.length || 0;
      return bH - aH;
    });

  for (const w of trueDiamondHands) {
    console.log(`${w}  (OG: ${holdings(w)})`);
  }
  console.log(`\nTrue diamond hands: ${trueDiamondHands.length} wallets`);
}

main().catch(console.error);
