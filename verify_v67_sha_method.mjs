import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);
const RPC = 'https://ethereum-rpc.publicnode.com';

async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return (await res.json()).result;
}

// The 3 items — check what the old SHAs actually belonged to in the DB
const oldShas = [
  { tokenId: 1569, oldSha: '2f829031713d4b6253dcefd9eab48bd55ae154430ccf6c279b27d49535b91155', newSha: 'a74c6c32160d810e40f64535b0512c33a061c737ac40d0ed02f5fc12e150fb0c', hashId: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d' },
  { tokenId: 2103, oldSha: 'dcb130d85be00f8fd735ddafcba1cc83f99ba8dab0fc79c833401827b615c92b', newSha: '0b4b796f20af242a1170dd679ef03fc658d707a495bcac65d904b858ca7e69ff', hashId: '0x1ed45d8d35d5b5f95b3bf2e97a1c5563d665b4653ba295f0961fefb4b84e7ae3' },
  { tokenId: 3719, oldSha: '504cd67bd212720e37e84fc714da78cdcc1e2daf05c1882219d99d22de8dee66', newSha: 'd7c7043710f6f1ecbd43db0d770f659a57d3378fabdbb1fab5736491b7c0ee98', hashId: '0x76e22f2334637a18a94c48e4be78cd23e0c938ea37e9de7bab3848e1a8a3a03d' },
];

for (const { tokenId, oldSha, newSha, hashId } of oldShas) {
  console.log(`\n#${tokenId}:`);

  // Does the old SHA belong to any other item in DB?
  const { data: oldOwner } = await sb.from('ethscriptions').select('hashId, tokenId, slug').eq('sha', oldSha).single();
  console.log(`  Old SHA owner in DB: ${oldOwner ? `#${oldOwner.tokenId} (${oldOwner.slug})` : 'NOBODY — old sha gone'}`);

  // Does the new SHA belong to any other item?
  const { data: newOwner } = await sb.from('ethscriptions').select('hashId, tokenId, slug').eq('sha', newSha).single();
  console.log(`  New SHA owner in DB: ${newOwner ? `#${newOwner.tokenId} (${newOwner.slug})` : 'NOBODY'}`);

  // What does on-chain say for this hashId?
  const tx = await rpc('eth_getTransactionByHash', [hashId]);
  const inputBytes = Buffer.from(tx.input.slice(2), 'hex');
  const shaBytes = createHash('sha256').update(inputBytes).digest('hex');
  const shaString = createHash('sha256').update(inputBytes.toString('utf8').replace(/\x00/g, '')).digest('hex');
  console.log(`  SHA(bytes):  ${shaBytes} ${shaBytes === newSha ? '= newSha ✓' : shaBytes === oldSha ? '= oldSha' : ''}`);
  console.log(`  SHA(string): ${shaString} ${shaString === newSha ? '= newSha ✓' : shaString === oldSha ? '= oldSha' : ''}`);

  // Who does the OLD sha belong to on-chain? (which tx has that sha)
  const { data: txWithOldSha } = await sb.from('ethscriptions').select('hashId, tokenId, slug').eq('sha', oldSha);
  console.log(`  Items with old sha in DB: ${txWithOldSha?.length ?? 0}`);
}
