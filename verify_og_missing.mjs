import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

const jsonData = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/ogmissingphunks/missing-phunks (4).json', 'utf8'));
const items = jsonData.collection_items ?? jsonData;
console.log(`JSON items: ${items.length}`);

// Get all og-missing-phunks from Supabase
const { data: dbItems } = await sb.from('ethscriptions').select('hashId, tokenId, sha').eq('slug', 'og-missing-phunks');
const dbMap = new Map(dbItems.map(r => [r.tokenId, r]));

// List storage images
let storageFiles = new Set(), offset = 0;
while (true) {
  const { data } = await sb.storage.from('static').list('images', { limit: 1000, offset });
  if (!data?.length) break;
  for (const f of data) storageFiles.add(f.name);
  offset += 1000;
  if (data.length < 1000) break;
}

// Get attribute file
const attrRes = await fetch('https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/data/og-missing-phunks_attributes.json');
const attrData = attrRes.status === 200 ? await attrRes.json() : null;
console.log(`Attr file: ${attrRes.status === 200 ? Object.keys(attrData).length + ' keys' : 'MISSING'}`);

let shaMismatch = 0, missingImage = 0, missingAttr = 0;

for (const item of items) {
  const tokenId = item.index ?? item.tokenId;
  const jsonSha = item.sha;
  const dbRow = dbMap.get(tokenId);

  if (!dbRow) { console.log(`#${tokenId}: NOT IN DB`); continue; }
  if (dbRow.sha !== jsonSha) {
    console.log(`#${tokenId} SHA: JSON=${jsonSha?.slice(0,12)} DB=${dbRow.sha?.slice(0,12)}`);
    shaMismatch++;
  }
  if (!storageFiles.has(jsonSha)) { console.log(`#${tokenId}: MISSING image ${jsonSha?.slice(0,12)}`); missingImage++; }
  if (attrData && !attrData[jsonSha]) { console.log(`#${tokenId}: MISSING in attr file`); missingAttr++; }
}

console.log(`\nSHA mismatches: ${shaMismatch} | Missing images: ${missingImage} | Missing in attr: ${missingAttr}`);
console.log(shaMismatch === 0 && missingImage === 0 && missingAttr === 0 ? '\n✓ All clean' : '\n✗ Issues found');
