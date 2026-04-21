import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);
const RPC = 'https://ethereum-rpc.publicnode.com';

const fixes = [
  { tokenId: 1569, hashId: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d', wrongSha: 'a74c6c32160d810e40f64535b0512c33a061c737ac40d0ed02f5fc12e150fb0c', correctSha: '2f829031713d4b6253dcefd9eab48bd55ae154430ccf6c279b27d49535b91155' },
  { tokenId: 2103, hashId: '0x1ed45d8d35d5b5f95b3bf2e97a1c5563d665b4653ba295f0961fefb4b84e7ae3', wrongSha: '0b4b796f20af242a1170dd679ef03fc658d707a495bcac65d904b858ca7e69ff', correctSha: 'dcb130d85be00f8fd735ddafcba1cc83f99ba8dab0fc79c833401827b615c92b' },
  { tokenId: 3719, hashId: '0x76e22f2334637a18a94c48e4be78cd23e0c938ea37e9de7bab3848e1a8a3a03d', wrongSha: 'd7c7043710f6f1ecbd43db0d770f659a57d3378fabdbb1fab5736491b7c0ee98', correctSha: '504cd67bd212720e37e84fc714da78cdcc1e2daf05c1882219d99d22de8dee66' },
];

async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return (await res.json()).result;
}

for (const { tokenId, hashId, wrongSha, correctSha } of fixes) {
  console.log(`\n#${tokenId}`);

  // 1. Fetch image from tx and upload under correct (original) SHA
  const tx = await rpc('eth_getTransactionByHash', [hashId]);
  const inputBytes = Buffer.from(tx.input.slice(2), 'hex');
  const dataUri = inputBytes.toString('utf8');
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) { console.log('  bad data URI'); continue; }
  const mimeType = match[1];
  const imageBytes = Buffer.from(match[2], 'base64');

  const { error: upErr } = await sb.storage.from('static').upload(`images/${correctSha}`, imageBytes, { contentType: mimeType, upsert: true });
  if (upErr) { console.error(`  upload error: ${upErr.message}`); continue; }
  console.log(`  uploaded images/${correctSha}`);

  // 2. Delete the wrong SHA image
  await sb.storage.from('static').remove([`images/${wrongSha}`]);
  console.log(`  deleted images/${wrongSha}`);

  // 3. Update Supabase sha
  const { error: dbErr } = await sb.from('ethscriptions').update({ sha: correctSha }).eq('hashId', hashId);
  if (dbErr) console.error(`  db error: ${dbErr.message}`);
  else console.log(`  supabase sha updated`);
}

// 4. Revert JSON
const jsonPath = 'C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/1 - CryptoPhunksV67.json';
const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'));
for (const { tokenId, wrongSha, correctSha } of fixes) {
  const item = jsonData.collection_items.find(x => x.index === tokenId);
  if (item) { item.sha = correctSha; console.log(`\nJSON #${tokenId} reverted`); }
}
writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));

// 5. Revert attribute file
console.log('\nUpdating attribute file...');
const BASE = 'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/data';
const res = await fetch(`${BASE}/cryptophunksv67_attributes.json`);
const attrData = await res.json();
for (const { wrongSha, correctSha } of fixes) {
  if (attrData[wrongSha]) {
    attrData[correctSha] = attrData[wrongSha];
    delete attrData[wrongSha];
    console.log(`  attr: ${wrongSha.slice(0,12)} → ${correctSha.slice(0,12)}`);
  }
}
const { error: attrErr } = await sb.storage.from('data').upload('cryptophunksv67_attributes.json', Buffer.from(JSON.stringify(attrData)), { contentType: 'application/json', upsert: true });
if (attrErr) console.error(`  attr upload error: ${attrErr.message}`);
else console.log('  attribute file updated');

console.log('\nDone.');
