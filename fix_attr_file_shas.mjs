import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

const BASE = 'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/data';

// The 3 SHA swaps
const swaps = [
  { oldSha: '2f829031713d4b6253dcefd9eab48bd55ae154430ccf6c279b27d49535b91155', newSha: 'a74c6c32160d810e40f64535b0512c33a061c737ac40d0ed02f5fc12e150fb0c' },
  { oldSha: 'dcb130d85be00f8fd735ddafcba1cc83f99ba8dab0fc79c833401827b615c92b', newSha: '0b4b796f20af242a1170dd679ef03fc658d707a495bcac65d904b858ca7e69ff' },
  { oldSha: '504cd67bd212720e37e84fc714da78cdcc1e2daf05c1882219d99d22de8dee66', newSha: 'd7c7043710f6f1ecbd43db0d770f659a57d3378fabdbb1fab5736491b7c0ee98' },
];

// Fetch current attribute file
const res = await fetch(`${BASE}/cryptophunksv67_attributes.json`);
const attrData = await res.json();

// Swap keys
for (const { oldSha, newSha } of swaps) {
  if (attrData[oldSha]) {
    attrData[newSha] = attrData[oldSha];
    delete attrData[oldSha];
    console.log(`Swapped: ${oldSha.slice(0,12)}... → ${newSha.slice(0,12)}...`);
  } else {
    console.log(`NOT FOUND: ${oldSha.slice(0,12)}...`);
  }
}

// Re-upload
const bytes = Buffer.from(JSON.stringify(attrData));
const { error } = await sb.storage.from('data').upload('cryptophunksv67_attributes.json', bytes, {
  contentType: 'application/json',
  upsert: true,
});
if (error) console.error('Upload error:', error.message);
else console.log('\nAttribute file updated ✓');

// Also check images for all 6 slugs
console.log('\n=== Image check per collection ===');
let allEths = [], from = 0;
while (true) {
  const { data } = await sb.from('ethscriptions').select('slug, sha, tokenId').range(from, from + 999);
  if (!data?.length) break;
  allEths = allEths.concat(data);
  from += 1000;
  if (data.length < 1000) break;
}

// List all storage images
let storageFiles = new Set(), offset = 0;
while (true) {
  const { data } = await sb.storage.from('static').list('images', { limit: 1000, offset });
  if (!data?.length) break;
  for (const f of data) storageFiles.add(f.name);
  offset += 1000;
  if (data.length < 1000) break;
}
console.log(`Total storage images: ${storageFiles.size}`);

const bySlag = {};
for (const r of allEths) {
  if (!bySlag[r.slug]) bySlag[r.slug] = [];
  bySlag[r.slug].push(r);
}

for (const [slug, items] of Object.entries(bySlag)) {
  const missing = items.filter(r => !storageFiles.has(r.sha));
  console.log(`${slug}: ${items.length} items, missing images: ${missing.length}${missing.length ? ' — ' + missing.slice(0,3).map(r=>'#'+r.tokenId).join(', ') : ''}`);
}
