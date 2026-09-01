// Generate allowlist: wallets that own at least 1 OG Missing Phunk, OG DystoPhunk, or mutated version
// Minus wallets blocked for listing/selling under 1.67 ETH
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = (process.env.SUPABASE_KEY || '');

const MARKET_ADDRESS = '0xa48a43186612b179c0bc68ea34b4932549a70bfa';

// All eligible collection slugs
const ELIGIBLE_SLUGS = [
  'og-missing-phunks',
  'og-dysto-phunks',
  'quantummissingphunksv67',
  'quantumdystophunkzv67',
];

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
  const holders = new Set();

  for (const slug of ELIGIBLE_SLUGS) {
    const items = await query('ethscriptions', {
      select: 'hashId,tokenId,owner,prevOwner',
      slug: `eq.${slug}`,
      limit: '1000',
    });

    let count = 0;
    for (const item of items) {
      // Effective owner: if in escrow (owner = market), use prevOwner
      let effectiveOwner = item.owner?.toLowerCase();
      if (effectiveOwner === MARKET_ADDRESS && item.prevOwner) {
        effectiveOwner = item.prevOwner.toLowerCase();
      }
      if (effectiveOwner && effectiveOwner !== '0x0000000000000000000000000000000000000000') {
        holders.add(effectiveOwner);
        count++;
      }
    }
    console.log(`${slug}: ${items.length} items, ${count} with owners`);
  }

  const sorted = [...holders].sort();
  console.log(`\nTotal unique holders: ${sorted.length}\n`);

  // Show all
  for (const w of sorted) {
    console.log(w);
  }

  console.log(`\n=== FOR setAllowedBatch() ===\n`);
  console.log(JSON.stringify(sorted, null, 2));
}

main().catch(console.error);
