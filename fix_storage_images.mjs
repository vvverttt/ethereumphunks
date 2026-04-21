import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);
const RPC = 'https://ethereum-rpc.publicnode.com';

const items = [
  { tokenId: 1569, hashId: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d', correctSha: 'a74c6c32160d810e40f64535b0512c33a061c737ac40d0ed02f5fc12e150fb0c', oldSha: '2f829031713d4b6253dcefd9eab48bd55ae154430ccf6c279b27d49535b91155' },
  { tokenId: 2103, hashId: '0x1ed45d8d35d5b5f95b3bf2e97a1c5563d665b4653ba295f0961fefb4b84e7ae3', correctSha: '0b4b796f20af242a1170dd679ef03fc658d707a495bcac65d904b858ca7e69ff', oldSha: 'dcb130d85be00f8fd735ddafcba1cc83f99ba8dab0fc79c833401827b615c92b' },
  { tokenId: 3719, hashId: '0x76e22f2334637a18a94c48e4be78cd23e0c938ea37e9de7bab3848e1a8a3a03d', correctSha: 'd7c7043710f6f1ecbd43db0d770f659a57d3378fabdbb1fab5736491b7c0ee98', oldSha: '504cd67bd212720e37e84fc714da78cdcc1e2daf05c1882219d99d22de8dee66' },
];

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const { result, error } = await res.json();
  if (error) throw new Error(`RPC error: ${error.message}`);
  return result;
}

for (const { tokenId, hashId, correctSha, oldSha } of items) {
  console.log(`\n#${tokenId}`);

  // Fetch tx and extract image bytes
  const tx = await rpc('eth_getTransactionByHash', [hashId]);
  const inputBytes = Buffer.from(tx.input.slice(2), 'hex');
  const dataUri = inputBytes.toString('utf8');

  // Parse data URI: data:image/png;base64,<data>
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error(`#${tokenId}: unexpected data URI format: ${dataUri.slice(0, 60)}`);
  const mimeType = match[1];
  const imageBytes = Buffer.from(match[2], 'base64');
  console.log(`  mime: ${mimeType}, size: ${imageBytes.length} bytes`);

  // Upload new image
  const { error: upErr } = await sb.storage.from('static').upload(`images/${correctSha}`, imageBytes, {
    contentType: mimeType,
    upsert: true,
  });
  if (upErr) { console.error(`  UPLOAD ERROR: ${upErr.message}`); continue; }
  console.log(`  Uploaded: images/${correctSha}`);

  // Delete old image
  const { error: delErr } = await sb.storage.from('static').remove([`images/${oldSha}`]);
  if (delErr) console.error(`  DELETE ERROR (old): ${delErr.message}`);
  else console.log(`  Deleted old: images/${oldSha}`);
}

console.log('\nDone.');
