// Check CURRENT holders - separated by collection
// Who sold/listed/escrowed, who didn't

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.BxG4LrAQOckVGBtAMtPUP4qnEpN-ZvTdRy53LEzbWyY';

const MARKET = '0xa48a43186612b179c0bc68ea34b4932549a70bfa';
const OLD_MARKET = '0xd3418772623be1a3cc6b6d45cb46420cedd9154a';
const contracts = new Set([MARKET, OLD_MARKET]);

async function query(table, params) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
}

async function processCollection(slug) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`=== ${slug.toUpperCase()} ===`);
  console.log(`${'='.repeat(60)}`);

  const items = await query('ethscriptions', {
    select: 'hashId,tokenId,owner,prevOwner,slug',
    slug: `eq.${slug}`,
    limit: '10000',
  });
  console.log(`Total items: ${items.length}`);

  // Current holders
  const currentHolders = new Map();
  for (const item of items) {
    const isEscrowed = contracts.has(item.owner);
    const trueOwner = isEscrowed ? item.prevOwner?.toLowerCase() : item.owner?.toLowerCase();
    if (!trueOwner || contracts.has(trueOwner)) continue;
    if (!currentHolders.has(trueOwner)) currentHolders.set(trueOwner, []);
    currentHolders.get(trueOwner).push({ tokenId: item.tokenId, escrowed: isEscrowed });
  }
  console.log(`Current unique holders: ${currentHolders.size}`);

  // Get all events + listings for this collection's items
  const walletActivity = new Map();
  function add(wallet, reason) {
    const w = wallet.toLowerCase();
    if (!currentHolders.has(w)) return;
    if (!walletActivity.has(w)) walletActivity.set(w, []);
    walletActivity.get(w).push(reason);
  }

  const batchSize = 20;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const hashIds = batch.map(b => b.hashId).join(',');

    const events = await query('events', {
      select: 'hashId,from,to,value,type,blockTimestamp',
      hashId: `in.(${hashIds})`,
      order: 'blockTimestamp.desc',
      limit: '1000',
    });

    for (const ev of events) {
      const item = items.find(x => x.hashId === ev.hashId);
      const date = ev.blockTimestamp?.slice(0, 10) || '?';

      if (ev.type === 'PhunkBought' || ev.type === 'sale') {
        const ethPrice = ev.value ? (Number(ev.value) / 1e18).toFixed(4) : '?';
        if (ev.from) add(ev.from, `SOLD #${item?.tokenId} for ${ethPrice} ETH (${date})`);
      } else if (ev.type === 'PhunkOffered') {
        const ethPrice = ev.value ? (Number(ev.value) / 1e18).toFixed(4) : '?';
        if (ev.from) add(ev.from, `LISTED #${item?.tokenId} at ${ethPrice} ETH (${date})`);
      } else if (ev.type === 'PhunkDeposited') {
        if (ev.from) add(ev.from, `DEPOSITED #${item?.tokenId} to escrow (${date})`);
      } else if (ev.type === 'transfer') {
        const fromLC = ev.from?.toLowerCase();
        const toLC = ev.to?.toLowerCase();
        if (fromLC && !contracts.has(fromLC) && toLC && !contracts.has(toLC)) {
          add(ev.from, `TRANSFERRED OUT #${item?.tokenId} (${date})`);
        }
      }
    }

    const listings = await query('listings', {
      select: 'hashId,listedBy,minValue,listed',
      hashId: `in.(${hashIds})`,
      limit: '1000',
    });
    for (const l of listings) {
      const item = items.find(x => x.hashId === l.hashId);
      const ethPrice = (Number(l.minValue) / 1e18).toFixed(4);
      const status = l.listed ? 'ACTIVE LISTING' : 'OLD LISTING';
      add(l.listedBy, `${status} #${item?.tokenId} at ${ethPrice} ETH`);
    }
  }

  for (const item of items) {
    if (contracts.has(item.owner) && item.prevOwner) {
      add(item.prevOwner, `IN ESCROW NOW #${item.tokenId}`);
    }
  }

  // Output: holders with activity
  console.log(`\n--- CURRENT HOLDERS WITH ACTIVITY ---\n`);
  let activeCount = 0;
  const sorted = [...currentHolders.keys()].sort();
  for (const wallet of sorted) {
    const acts = walletActivity.get(wallet);
    if (acts && acts.length > 0) {
      activeCount++;
      const held = currentHolders.get(wallet);
      const unique = [...new Set(acts)];
      console.log(`${wallet}  (holds ${held.length})`);
      for (const a of unique) console.log(`    ${a}`);
      console.log('');
    }
  }
  console.log(`Active: ${activeCount} / ${currentHolders.size} holders\n`);

  // Output: diamond hands
  console.log(`--- DIAMOND HANDS (zero activity) ---\n`);
  const dh = sorted
    .filter(w => { const a = walletActivity.get(w); return !a || a.length === 0; })
    .sort((a, b) => (currentHolders.get(b)?.length || 0) - (currentHolders.get(a)?.length || 0));

  for (const w of dh) {
    const held = currentHolders.get(w);
    const tokenIds = held.map(h => `#${h.tokenId}`).join(', ');
    console.log(`${w}  (holds ${held.length}: ${tokenIds})`);
  }
  console.log(`\nDiamond hands: ${dh.length} / ${currentHolders.size} holders`);
}

async function main() {
  await processCollection('og-missing-phunks');
  await processCollection('og-dysto-phunks');
}

main().catch(console.error);
