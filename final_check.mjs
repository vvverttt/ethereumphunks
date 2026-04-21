import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

// 1. DB row count per slug
let all = [], from = 0;
while (true) {
  const { data } = await sb.from('ethscriptions').select('slug, sha, owner, hashId, tokenId').range(from, from + 999);
  if (!data?.length) break;
  all = all.concat(data);
  from += 1000;
  if (data.length < 1000) break;
}
const counts = {};
for (const r of all) counts[r.slug] = (counts[r.slug] || 0) + 1;
console.log('=== DB counts ===');
for (const [slug, count] of Object.entries(counts)) console.log(`  ${slug}: ${count}`);

// 2. Storage images
let storageFiles = new Set(), offset = 0;
while (true) {
  const { data } = await sb.storage.from('static').list('images', { limit: 1000, offset });
  if (!data?.length) break;
  for (const f of data) storageFiles.add(f.name);
  offset += 1000;
  if (data.length < 1000) break;
}
const missingImages = all.filter(r => !storageFiles.has(r.sha));
console.log(`\n=== Images ===`);
console.log(`  Storage files: ${storageFiles.size} | Missing: ${missingImages.length}`);

// 3. JSON vs DB sha check for cryptophunksv67
const v67 = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/1 - CryptoPhunksV67.json', 'utf8')).collection_items;
const dbMap = new Map(all.filter(r => r.slug === 'cryptophunksv67').map(r => [r.tokenId, r.sha]));
const v67Mismatches = v67.filter(x => dbMap.get(x.index) !== x.sha);
console.log(`\n=== v67 JSON vs DB ===`);
console.log(`  Mismatches: ${v67Mismatches.length}`);

// 4. og-missing-phunks JSON vs DB
const ogMissing = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/ogmissingphunks/missing-phunks (4).json', 'utf8')).collection_items;
const ogMap = new Map(all.filter(r => r.slug === 'og-missing-phunks').map(r => [r.tokenId, r.sha]));
const ogMismatches = ogMissing.filter(x => ogMap.get(x.index) !== x.sha);
console.log(`\n=== og-missing-phunks JSON vs DB ===`);
console.log(`  Mismatches: ${ogMismatches.length}`);

// 5. 8 invalid items ownership check
const invalid8 = [
  { tokenId: 1569, hashId: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d' },
  { tokenId: 2103, hashId: '0x1ed45d8d35d5b5f95b3bf2e97a1c5563d665b4653ba295f0961fefb4b84e7ae3' },
  { tokenId: 3080, hashId: '0xee0cfcae35f9f839d93b21fa815b310a660b458eb1029f5a4cdc6ccd0b5bd8eb' },
  { tokenId: 3719, hashId: '0x76e22f2334637a18a94c48e4be78cd23e0c938ea37e9de7bab3848e1a8a3a03d' },
  { tokenId: 8663, hashId: '0xaf3227fa491fbbf0eb4adc1b9078fcca3ea8f2f79916f98822c89d6f702861cd' },
  { tokenId: 8699, hashId: '0x554205831931235cbee89cfc56facf1f32e9128674a522b9e2d4a6c7d9507919' },
  { tokenId: 9360, hashId: '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0' },
  { tokenId: 9363, hashId: '0xf8f8b15a6b2aebbd8cea5348c75a921ed19846aa1f31b3667b3993866ebdc573' },
];
const dbByHash = new Map(all.map(r => [r.hashId, r]));
const correctOwner = '0xea04f65f9dc5917302532859d80fcf36a15de266';
console.log(`\n=== 8 invalid items ownership ===`);
for (const { tokenId, hashId } of invalid8) {
  const row = dbByHash.get(hashId);
  const ok = row?.owner?.toLowerCase() === correctOwner;
  console.log(`  #${tokenId}: ${ok ? '✓' : '✗ owner=' + row?.owner?.slice(0,14)}`);
}

// 6. Attr files
console.log(`\n=== Attribute files ===`);
const slugs = ['cryptophunksv67', 'og-missing-phunks', 'og-dysto-phunks', 'ethsrock', 'quantummissingphunksv67', 'quantumdystophunkzv67'];
for (const slug of slugs) {
  const res = await fetch(`https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/data/${slug}_attributes.json`);
  console.log(`  ${slug}: HTTP ${res.status}`);
}
