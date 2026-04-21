// Find current holders who listed/sold OG items but ONLY above 0.67 ETH
// These are NOT diamond hands but not dumpers either

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.BxG4LrAQOckVGBtAMtPUP4qnEpN-ZvTdRy53LEzbWyY';

const MARKET = '0xa48a43186612b179c0bc68ea34b4932549a70bfa';
const OLD_MARKET = '0xd3418772623be1a3cc6b6d45cb46420cedd9154a';
const contracts = new Set([MARKET, OLD_MARKET]);
const THRESHOLD = 0.67;
const THRESHOLD_WEI = BigInt(Math.floor(THRESHOLD * 1e18));

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

  // Current holders
  const currentHolders = new Map();
  for (const item of items) {
    const isEscrowed = contracts.has(item.owner);
    const trueOwner = isEscrowed ? item.prevOwner?.toLowerCase() : item.owner?.toLowerCase();
    if (!trueOwner || contracts.has(trueOwner)) continue;
    if (!currentHolders.has(trueOwner)) currentHolders.set(trueOwner, []);
    currentHolders.get(trueOwner).push({ tokenId: item.tokenId });
  }

  // Track activity per wallet: did they ever list/sell BELOW threshold?
  const belowThreshold = new Set(); // wallets that sold/listed below 0.67
  const aboveThreshold = new Map(); // wallets that had activity but all >= 0.67

  const batchSize = 20;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const hashIds = batch.map(b => b.hashId).join(',');

    // Sales
    const sales = await query('events', {
      select: 'hashId,from,value,type',
      hashId: `in.(${hashIds})`,
      type: `in.(PhunkBought,sale)`,
      limit: '500',
    });
    for (const s of sales) {
      if (!s.from || !s.value) continue;
      const w = s.from.toLowerCase();
      if (!currentHolders.has(w)) continue;
      const price = BigInt(s.value);
      if (price < THRESHOLD_WEI) {
        belowThreshold.add(w);
      } else {
        if (!aboveThreshold.has(w)) aboveThreshold.set(w, []);
        const item = items.find(x => x.hashId === s.hashId);
        aboveThreshold.get(w).push(`SOLD #${item?.tokenId} for ${(Number(s.value) / 1e18).toFixed(4)} ETH`);
      }
    }

    // Listings (active)
    const listings = await query('listings', {
      select: 'hashId,listedBy,minValue,listed',
      hashId: `in.(${hashIds})`,
      listed: 'eq.true',
    });
    for (const l of listings) {
      const w = l.listedBy.toLowerCase();
      if (!currentHolders.has(w)) continue;
      const price = BigInt(l.minValue);
      if (price < THRESHOLD_WEI) {
        belowThreshold.add(w);
      } else {
        if (!aboveThreshold.has(w)) aboveThreshold.set(w, []);
        const item = items.find(x => x.hashId === l.hashId);
        aboveThreshold.get(w).push(`LISTED #${item?.tokenId} at ${(Number(l.minValue) / 1e18).toFixed(4)} ETH`);
      }
    }

    // Historical listings (PhunkOffered)
    const offers = await query('events', {
      select: 'hashId,from,value',
      hashId: `in.(${hashIds})`,
      type: `eq.PhunkOffered`,
      limit: '500',
    });
    for (const o of offers) {
      if (!o.from || !o.value) continue;
      const w = o.from.toLowerCase();
      if (!currentHolders.has(w)) continue;
      const price = BigInt(o.value);
      if (price < THRESHOLD_WEI) {
        belowThreshold.add(w);
      }
    }
  }

  // Filter: wallets that had activity above threshold but NEVER below
  const eligible = [...aboveThreshold.entries()]
    .filter(([w]) => !belowThreshold.has(w))
    .sort((a, b) => a[0].localeCompare(b[0]));

  console.log(`\nCurrent holders: ${currentHolders.size}`);
  console.log(`Listed/sold above ${THRESHOLD} ETH (never below): ${eligible.length}\n`);

  for (const [wallet, activity] of eligible) {
    const held = currentHolders.get(wallet)?.length || 0;
    console.log(`${wallet}  (holds ${held})`);
    for (const a of activity) console.log(`    ${a}`);
  }

  console.log(`\nAddresses only:`);
  console.log(JSON.stringify(eligible.map(([w]) => w), null, 2));

  return eligible.map(([w]) => w);
}

async function main() {
  const missing = await processCollection('og-missing-phunks');
  const dysto = await processCollection('og-dysto-phunks');

  const overlap = missing.filter(w => dysto.includes(w));
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`OG Missing above ${THRESHOLD}: ${missing.length}`);
  console.log(`OG Dysto above ${THRESHOLD}: ${dysto.length}`);
  console.log(`Overlap: ${overlap.length}`);
}

main().catch(console.error);
