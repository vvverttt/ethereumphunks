// Thorough check: for OG missing/dysto items, check ALL event types per item
// to make sure diamond hands truly never had any activity

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
  // Step 1: Get all OG items
  const allItems = [];
  for (const slug of OG_SLUGS) {
    const items = await query('ethscriptions', {
      select: 'hashId,tokenId,owner,prevOwner,slug',
      slug: `eq.${slug}`,
      limit: '10000',
    });
    console.log(`${slug}: ${items.length} items`);
    allItems.push(...items);
  }

  // Step 2: Get ALL events for ALL OG items
  const batchSize = 20;
  const allEvents = [];
  for (let i = 0; i < allItems.length; i += batchSize) {
    const batch = allItems.slice(i, i + batchSize);
    const hashIds = batch.map(b => b.hashId).join(',');
    const events = await query('events', {
      select: 'hashId,from,to,value,type,blockTimestamp',
      hashId: `in.(${hashIds})`,
      order: 'blockTimestamp.desc',
      limit: '1000',
    });
    allEvents.push(...events);
  }
  console.log(`\nTotal events across all OG items: ${allEvents.length}`);

  // Step 3: Get ALL listings (active or not) for OG items
  const allListings = [];
  for (let i = 0; i < allItems.length; i += batchSize) {
    const batch = allItems.slice(i, i + batchSize);
    const hashIds = batch.map(b => b.hashId).join(',');
    const listings = await query('listings', {
      select: 'hashId,listedBy,minValue,listed',
      hashId: `in.(${hashIds})`,
      limit: '1000',
    });
    allListings.push(...listings);
  }
  console.log(`Total listings (active + inactive): ${allListings.length}`);

  // Build hashId -> item lookup
  const hashToItem = new Map();
  for (const item of allItems) hashToItem.set(item.hashId, item);

  // Step 4: Build per-wallet activity
  const walletActivity = new Map(); // wallet -> reasons[]

  function add(wallet, reason) {
    const w = wallet.toLowerCase();
    if (!walletActivity.has(w)) walletActivity.set(w, []);
    walletActivity.get(w).push(reason);
  }

  // Events
  for (const ev of allEvents) {
    const item = hashToItem.get(ev.hashId);
    const label = `${item?.slug} #${item?.tokenId}`;
    const date = ev.blockTimestamp?.slice(0, 10) || '?';

    if (ev.type === 'PhunkBought' || ev.type === 'sale') {
      const ethPrice = ev.value ? (Number(ev.value) / 1e18).toFixed(4) : '?';
      if (ev.from) add(ev.from, `SOLD ${label} for ${ethPrice} ETH (${date})`);
    } else if (ev.type === 'PhunkOffered') {
      const ethPrice = ev.value ? (Number(ev.value) / 1e18).toFixed(4) : '?';
      if (ev.from) add(ev.from, `LISTED ${label} at ${ethPrice} ETH (${date})`);
    } else if (ev.type === 'PhunkDeposited') {
      if (ev.from) add(ev.from, `DEPOSITED ${label} to escrow (${date})`);
    } else if (ev.type === 'PhunkWithdrawn') {
      // withdrawn = delisted, less concerning but still activity
      if (ev.to) add(ev.to, `WITHDRAWN ${label} from escrow (${date})`);
    } else if (ev.type === 'transfer') {
      // transfers that aren't to/from market contracts = wallet-to-wallet
      const fromLC = ev.from?.toLowerCase();
      const toLC = ev.to?.toLowerCase();
      if (fromLC && fromLC !== MARKET && fromLC !== OLD_MARKET &&
          toLC && toLC !== MARKET && toLC !== OLD_MARKET) {
        add(ev.from, `TRANSFERRED OUT ${label} to ${ev.to?.slice(0,10)}... (${date})`);
      }
    }
  }

  // Listings (including inactive)
  for (const l of allListings) {
    const item = hashToItem.get(l.hashId);
    const label = `${item?.slug} #${item?.tokenId}`;
    const ethPrice = (Number(l.minValue) / 1e18).toFixed(4);
    const status = l.listed ? 'ACTIVE' : 'INACTIVE';
    add(l.listedBy, `LISTING (${status}) ${label} at ${ethPrice} ETH`);
  }

  // Escrow status
  for (const item of allItems) {
    if (item.owner === MARKET || item.owner === OLD_MARKET) {
      if (item.prevOwner) {
        add(item.prevOwner, `IN ESCROW NOW ${item.slug} #${item.tokenId}`);
      }
    }
  }

  // Step 5: Determine true owners
  const ownerHoldings = new Map(); // wallet -> [{slug, tokenId}]
  for (const item of allItems) {
    const isEscrowed = (item.owner === MARKET || item.owner === OLD_MARKET);
    const trueOwner = isEscrowed ? item.prevOwner?.toLowerCase() : item.owner?.toLowerCase();
    if (!trueOwner) continue;
    if (!ownerHoldings.has(trueOwner)) ownerHoldings.set(trueOwner, []);
    ownerHoldings.get(trueOwner).push({ slug: item.slug, tokenId: item.tokenId });
  }

  const contracts = new Set([MARKET, OLD_MARKET]);
  const holders = [...ownerHoldings.entries()].filter(([w]) => !contracts.has(w));

  const holdings = (w) => {
    const h = ownerHoldings.get(w) || [];
    const missing = h.filter(x => x.slug === 'og-missing-phunks').length;
    const dysto = h.filter(x => x.slug === 'og-dysto-phunks').length;
    const parts = [];
    if (missing) parts.push(`${missing} missing`);
    if (dysto) parts.push(`${dysto} dysto`);
    return parts.join(', ');
  };

  // Step 6: Separate into active vs diamond hands
  console.log(`\n========================================`);
  console.log(`=== HOLDERS WITH ANY OG ACTIVITY ===`);
  console.log(`========================================\n`);

  let activeCount = 0;
  for (const [wallet] of holders) {
    const acts = walletActivity.get(wallet.toLowerCase());
    if (acts && acts.length > 0) {
      activeCount++;
      // Dedupe
      const unique = [...new Set(acts)];
      console.log(`${wallet}  (holds: ${holdings(wallet)})`);
      for (const a of unique) console.log(`    ${a}`);
      console.log('');
    }
  }
  console.log(`Total with activity: ${activeCount}\n`);

  console.log(`========================================`);
  console.log(`=== TRUE DIAMOND HANDS (zero OG activity) ===`);
  console.log(`========================================\n`);

  const trueDH = holders
    .filter(([w]) => {
      const acts = walletActivity.get(w.toLowerCase());
      return !acts || acts.length === 0;
    })
    .sort((a, b) => b[1].length - a[1].length);

  for (const [wallet] of trueDH) {
    console.log(`${wallet}  (holds: ${holdings(wallet)})`);
  }
  console.log(`\nTrue diamond hands: ${trueDH.length} wallets`);
  console.log(`Total holders: ${holders.length} wallets`);
}

main().catch(console.error);
