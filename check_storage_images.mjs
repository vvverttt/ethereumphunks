import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

// Fetch all ethscriptions from Supabase
let all = [];
let from = 0;
while (true) {
  const { data, error } = await sb.from('ethscriptions').select('hashId, tokenId, sha, slug').range(from, from + 999);
  if (error) { console.error(error); break; }
  if (!data.length) break;
  all = all.concat(data);
  from += 1000;
  if (data.length < 1000) break;
}
console.log(`Total ethscriptions: ${all.length}`);

// List all files in static/images bucket
console.log('Listing storage files...');
let storageFiles = new Set();
let offset = 0;
while (true) {
  const { data, error } = await sb.storage.from('static').list('images', { limit: 1000, offset });
  if (error) { console.error(error); break; }
  if (!data.length) break;
  for (const f of data) storageFiles.add(f.name);
  offset += 1000;
  if (data.length < 1000) break;
}
console.log(`Storage files in static/images: ${storageFiles.size}`);

// Check each ethscription has its image
let missing = 0;
for (const row of all) {
  if (!storageFiles.has(row.sha)) {
    console.log(`MISSING image: #${row.tokenId} (${row.slug}) sha=${row.sha}`);
    missing++;
  }
}

console.log(`\nDone. Missing images: ${missing} | Present: ${all.length - missing}`);
