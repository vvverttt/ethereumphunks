import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);
const RPC = 'https://ethereum-rpc.publicnode.com';

const invalid8 = [
  { tokenId: 1569, hashId: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d', shaMismatch: true },
  { tokenId: 2103, hashId: '0x1ed45d8d35d5b5f95b3bf2e97a1c5563d665b4653ba295f0961fefb4b84e7ae3', shaMismatch: true },
  { tokenId: 3080, hashId: '0xee0cfcae35f9f839d93b21fa815b310a660b458eb1029f5a4cdc6ccd0b5bd8eb', shaMismatch: false },
  { tokenId: 3719, hashId: '0x76e22f2334637a18a94c48e4be78cd23e0c938ea37e9de7bab3848e1a8a3a03d', shaMismatch: true },
  { tokenId: 8663, hashId: '0xaf3227fa491fbbf0eb4adc1b9078fcca3ea8f2f79916f98822c89d6f702861cd', shaMismatch: false },
  { tokenId: 8699, hashId: '0x554205831931235cbee89cfc56facf1f32e9128674a522b9e2d4a6c7d9507919', shaMismatch: false },
  { tokenId: 9360, hashId: '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0', shaMismatch: false },
  { tokenId: 9363, hashId: '0xf8f8b15a6b2aebbd8cea5348c75a921ed19846aa1f31b3667b3993866ebdc573', shaMismatch: false },
];

async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return (await res.json()).result;
}

console.log('tokenId | sha issue | DB owner                                   | on-chain from');
console.log('--------|-----------|--------------------------------------------|--------------');

for (const { tokenId, hashId, shaMismatch } of invalid8) {
  const { data } = await sb.from('ethscriptions').select('owner, prevOwner').eq('hashId', hashId).single();
  const tx = await rpc('eth_getTransactionByHash', [hashId]);
  const onChainFrom = tx?.from ?? 'N/A';
  const ownerOk = data?.owner?.toLowerCase() === '0xea04f65f9dc5917302532859d80fcf36a15de266';
  console.log(`#${tokenId}  | ${shaMismatch ? 'SHA ✗  ' : 'SHA ✓  '} | ${data?.owner} ${ownerOk ? '✓' : '✗'} | ${onChainFrom}`);
}
