import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

const CONTRACT = '0x0b4a5c756c4df0a6fb399bf73ce5667a746dbfba';

const { data, error } = await sb
  .from('ethscriptions')
  .select('tokenId, hashId, slug, sha')
  .eq('owner', CONTRACT)
  .order('slug')
  .order('tokenId');

if (error) { console.error(error); process.exit(1); }

console.log(`Total in contract: ${data.length}\n`);

const bySlug = {};
for (const row of data) {
  if (!bySlug[row.slug]) bySlug[row.slug] = [];
  bySlug[row.slug].push({ tokenId: row.tokenId, hashId: row.hashId, sha: row.sha });
}

for (const [slug, items] of Object.entries(bySlug)) {
  console.log(`\n[${slug}] — ${items.length} tokens`);
  for (const item of items) {
    console.log(`  #${item.tokenId}  ${item.hashId}`);
  }
}

writeFileSync('contract-holdings.json', JSON.stringify({ total: data.length, bySlug }, null, 2));
console.log('\nWritten to contract-holdings.json');
