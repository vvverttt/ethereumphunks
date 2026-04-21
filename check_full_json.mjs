import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

const raw = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/1 - CryptoPhunksV67.json', 'utf8'));
const items = raw.collection_items;
console.log(`JSON items: ${items.length}`);

// Fetch all ethscriptions from Supabase in batches
let all = [];
let from = 0;
const batchSize = 1000;
while (true) {
  const { data, error } = await sb.from('ethscriptions').select('hashId, tokenId, sha').range(from, from + batchSize - 1);
  if (error) { console.error(error); break; }
  if (!data.length) break;
  all = all.concat(data);
  from += batchSize;
  if (data.length < batchSize) break;
}
console.log(`Supabase rows: ${all.length}`);

const sbMap = new Map(all.map(r => [r.hashId?.toLowerCase(), r]));

let mismatches = 0;
let notFound = 0;

for (const item of items) {
  const hashId = item.id?.toLowerCase();
  const sbRow = sbMap.get(hashId);
  if (!sbRow) {
    console.log(`#${item.index} NOT IN SUPABASE — ${hashId}`);
    notFound++;
    continue;
  }
  if (item.sha !== sbRow.sha) {
    console.log(`#${item.index} SHA MISMATCH:`);
    console.log(`  JSON:     ${item.sha}`);
    console.log(`  Supabase: ${sbRow.sha}`);
    mismatches++;
  }
}

console.log(`\nDone. Mismatches: ${mismatches} | Not in Supabase: ${notFound} | Clean: ${items.length - mismatches - notFound}`);
