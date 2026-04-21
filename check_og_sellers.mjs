// Block wallets that listed or sold Missing Phunks OG / DystoPhunks OG under 1.67 ETH
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.BxG4LrAQOckVGBtAMtPUP4qnEpN-ZvTdRy53LEzbWyY';

const OG_SLUGS = ['og-missing-phunks', 'og-dysto-phunks'];
const THRESHOLD_ETH = 1.67;
const THRESHOLD_WEI = BigInt(Math.floor(THRESHOLD_ETH * 1e18));

async function query(table, params) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  return res.json();
}

async function main() {
  const walletsToBlock = new Set();
  const reasons = {}; // wallet -> reasons[]

  function addWallet(wallet, reason) {
    const w = wallet.toLowerCase();
    walletsToBlock.add(w);
    if (!reasons[w]) reasons[w] = [];
    reasons[w].push(reason);
  }

  for (const slug of OG_SLUGS) {
    const items = await query('ethscriptions', {
      select: 'hashId,tokenId',
      slug: `eq.${slug}`,
      limit: '1000',
    });
    console.log(`\n${slug}: ${items.length} items`);

    const batchSize = 20;

    // 1. Active listings under threshold
    console.log(`\n  --- Active listings under ${THRESHOLD_ETH} ETH ---`);
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const hashIds = batch.map(b => b.hashId).join(',');
      const listings = await query('listings', {
        select: 'hashId,listedBy,minValue,listed',
        hashId: `in.(${hashIds})`,
        listed: 'eq.true',
      });
      for (const l of listings) {
        const price = BigInt(l.minValue);
        if (price < THRESHOLD_WEI) {
          const item = items.find(i => i.hashId === l.hashId);
          const ethPrice = (Number(l.minValue) / 1e18).toFixed(4);
          console.log(`  #${item?.tokenId} listed by ${l.listedBy} for ${ethPrice} ETH`);
          addWallet(l.listedBy, `${slug} #${item?.tokenId} listed at ${ethPrice} ETH`);
        }
      }
    }

    // 2. Sales under threshold
    console.log(`\n  --- Sales under ${THRESHOLD_ETH} ETH ---`);
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const hashIds = batch.map(b => b.hashId).join(',');
      const sales = await query('events', {
        select: 'hashId,from,to,value,type,blockTimestamp',
        hashId: `in.(${hashIds})`,
        type: `in.(PhunkBought,sale)`,
        order: 'blockTimestamp.desc',
        limit: '200',
      });
      for (const s of sales) {
        if (!s.value) continue;
        const price = BigInt(s.value);
        if (price < THRESHOLD_WEI) {
          const item = items.find(i => i.hashId === s.hashId);
          const ethPrice = (Number(s.value) / 1e18).toFixed(4);
          console.log(`  #${item?.tokenId} sold by ${s.from} for ${ethPrice} ETH (${s.blockTimestamp})`);
          if (s.from) addWallet(s.from, `${slug} #${item?.tokenId} sold at ${ethPrice} ETH`);
        }
      }
    }

    // 3. Historical listing events (PhunkOffered) under threshold
    console.log(`\n  --- Historical listings under ${THRESHOLD_ETH} ETH ---`);
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const hashIds = batch.map(b => b.hashId).join(',');
      const offers = await query('events', {
        select: 'hashId,from,value,type,blockTimestamp',
        hashId: `in.(${hashIds})`,
        type: `eq.PhunkOffered`,
        order: 'blockTimestamp.desc',
        limit: '200',
      });
      for (const o of offers) {
        if (!o.value) continue;
        const price = BigInt(o.value);
        if (price < THRESHOLD_WEI) {
          const item = items.find(i => i.hashId === o.hashId);
          const ethPrice = (Number(o.value) / 1e18).toFixed(4);
          console.log(`    #${item?.tokenId} listed by ${o.from} for ${ethPrice} ETH (${o.blockTimestamp})`);
          if (o.from) addWallet(o.from, `${slug} #${item?.tokenId} listed at ${ethPrice} ETH (history)`);
        }
      }
    }
  }

  // Summary
  const sorted = [...walletsToBlock].sort();
  console.log(`\n=== WALLETS TO BLOCK (listed or sold under ${THRESHOLD_ETH} ETH) ===\n`);
  console.log(`Total: ${sorted.length} wallet(s)\n`);
  for (const w of sorted) {
    console.log(`${w}`);
    for (const r of reasons[w]) {
      console.log(`    ${r}`);
    }
  }

  console.log(`\n=== FOR setBlockedBatch() ===\n`);
  console.log(JSON.stringify(sorted, null, 2));
}

main().catch(console.error);
