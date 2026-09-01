// Find current holders who listed/sold above 0.67 ETH
// Exclude anyone who EVER sold/listed below 0.67 in EITHER collection

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = (process.env.SUPABASE_KEY || '');

const MARKET = '0xa48a43186612b179c0bc68ea34b4932549a70bfa';
const OLD_MARKET = '0xd3418772623be1a3cc6b6d45cb46420cedd9154a';
const contracts = new Set([MARKET, OLD_MARKET]);
const THRESHOLD = 0.67;
const THRESHOLD_WEI = BigInt(Math.floor(THRESHOLD * 1e18));
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
  // Step 1: Gather ALL items across both collections
  const allItems = [];
  const holdersBySlug = { 'og-missing-phunks': new Map(), 'og-dysto-phunks': new Map() };

  for (const slug of OG_SLUGS) {
    const items = await query('ethscriptions', {
      select: 'hashId,tokenId,owner,prevOwner,slug',
      slug: `eq.${slug}`,
      limit: '10000',
    });
    console.log(`${slug}: ${items.length} items`);
    allItems.push(...items);

    for (const item of items) {
      const isEscrowed = contracts.has(item.owner);
      const trueOwner = isEscrowed ? item.prevOwner?.toLowerCase() : item.owner?.toLowerCase();
      if (!trueOwner || contracts.has(trueOwner)) continue;
      if (!holdersBySlug[slug].has(trueOwner)) holdersBySlug[slug].set(trueOwner, []);
      holdersBySlug[slug].get(trueOwner).push({ tokenId: item.tokenId });
    }
  }

  // Step 2: Find ALL wallets that ever sold/listed below threshold in EITHER collection
  const belowThreshold = new Set();
  const aboveActivity = new Map(); // wallet -> [{slug, activity}]

  const batchSize = 20;
  for (let i = 0; i < allItems.length; i += batchSize) {
    const batch = allItems.slice(i, i + batchSize);
    const hashIds = batch.map(b => b.hashId).join(',');

    const sales = await query('events', {
      select: 'hashId,from,value,type',
      hashId: `in.(${hashIds})`,
      type: `in.(PhunkBought,sale)`,
      limit: '500',
    });
    for (const s of sales) {
      if (!s.from || !s.value) continue;
      const w = s.from.toLowerCase();
      const price = BigInt(s.value);
      const item = allItems.find(x => x.hashId === s.hashId);
      if (price < THRESHOLD_WEI) {
        belowThreshold.add(w);
      } else {
        if (!aboveActivity.has(w)) aboveActivity.set(w, []);
        aboveActivity.get(w).push(`SOLD ${item?.slug} #${item?.tokenId} for ${(Number(s.value) / 1e18).toFixed(4)} ETH`);
      }
    }

    const listings = await query('listings', {
      select: 'hashId,listedBy,minValue,listed',
      hashId: `in.(${hashIds})`,
      listed: 'eq.true',
    });
    for (const l of listings) {
      const w = l.listedBy.toLowerCase();
      const price = BigInt(l.minValue);
      const item = allItems.find(x => x.hashId === l.hashId);
      if (price < THRESHOLD_WEI) {
        belowThreshold.add(w);
      } else {
        if (!aboveActivity.has(w)) aboveActivity.set(w, []);
        aboveActivity.get(w).push(`LISTED ${item?.slug} #${item?.tokenId} at ${(Number(l.minValue) / 1e18).toFixed(4)} ETH`);
      }
    }

    const offers = await query('events', {
      select: 'hashId,from,value',
      hashId: `in.(${hashIds})`,
      type: `eq.PhunkOffered`,
      limit: '500',
    });
    for (const o of offers) {
      if (!o.from || !o.value) continue;
      const w = o.from.toLowerCase();
      const price = BigInt(o.value);
      if (price < THRESHOLD_WEI) {
        belowThreshold.add(w);
      }
    }
  }

  // Step 3: Filter - only wallets with above-threshold activity and NEVER below in either collection
  const eligible = [...aboveActivity.entries()]
    .filter(([w]) => !belowThreshold.has(w));

  // Split by which collection they currently hold
  const missingEligible = eligible.filter(([w]) => holdersBySlug['og-missing-phunks'].has(w));
  const dystoEligible = eligible.filter(([w]) => holdersBySlug['og-dysto-phunks'].has(w));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`=== OG MISSING — ELIGIBLE (listed/sold above ${THRESHOLD}, never below in either) ===`);
  console.log(`${'='.repeat(60)}\n`);
  for (const [w, acts] of missingEligible) {
    const held = holdersBySlug['og-missing-phunks'].get(w)?.length || 0;
    console.log(`${w}  (holds ${held} missing)`);
    for (const a of [...new Set(acts)]) console.log(`    ${a}`);
  }
  console.log(`\nTotal: ${missingEligible.length}`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`=== OG DYSTO — ELIGIBLE (listed/sold above ${THRESHOLD}, never below in either) ===`);
  console.log(`${'='.repeat(60)}\n`);
  for (const [w, acts] of dystoEligible) {
    const held = holdersBySlug['og-dysto-phunks'].get(w)?.length || 0;
    console.log(`${w}  (holds ${held} dysto)`);
    for (const a of [...new Set(acts)]) console.log(`    ${a}`);
  }
  console.log(`\nTotal: ${dystoEligible.length}`);

  const overlap = missingEligible.filter(([w]) => dystoEligible.some(([d]) => d === w));
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  console.log(`OG Missing eligible: ${missingEligible.length}`);
  console.log(`OG Dysto eligible:   ${dystoEligible.length}`);
  console.log(`Overlap:             ${overlap.length}`);
  console.log(`\nMissing addresses: ${JSON.stringify(missingEligible.map(([w]) => w))}`);
  console.log(`Dysto addresses:   ${JSON.stringify(dystoEligible.map(([w]) => w))}`);
}

main().catch(console.error);
