import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

const EVOLVE_CONTRACT = '0x0b4a5c756c4df0a6fb399bf73ce5667a746dbfba';

// Check what's currently in the evolve contract
const { data: inContract } = await sb.from('ethscriptions')
  .select('hashId, tokenId, slug')
  .eq('owner', EVOLVE_CONTRACT)
  .order('tokenId');

console.log(`=== ALL ITEMS IN CONTRACT (${inContract?.length}) ===`);
const bySlug = {};
for (const p of (inContract || [])) {
  bySlug[p.slug] = bySlug[p.slug] || [];
  bySlug[p.slug].push(p.tokenId);
}
for (const [slug, ids] of Object.entries(bySlug)) {
  console.log(`${slug}: ${ids.length} items — tokenIds: ${ids.join(', ')}`);
}

// Check lottery table
const { data: lotteryData, error: lErr } = await sb.from('lottery').select('*').limit(100);
if (lErr) {
  console.log('\nlottery table:', lErr.message);
} else {
  console.log(`\nlottery table: ${lotteryData?.length} rows`);
  lotteryData?.forEach(r => console.log(' ', JSON.stringify(r)));
}

// Check escrow events (old lottery deposits)
const { data: escrowEvts } = await sb.from('events')
  .select('hashId, type, blockNumber, blockTimestamp')
  .eq('type', 'escrow')
  .order('blockTimestamp', { ascending: false })
  .limit(20);
console.log(`\nRecent escrow events: ${escrowEvts?.length}`);
escrowEvts?.forEach(e => console.log(` hashId=${e.hashId?.slice(0,20)} block=${e.blockNumber} ts=${e.blockTimestamp?.slice(0,10)}`));
