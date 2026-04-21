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

// Check the 3 URLs
const urls = [
  'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/data/cryptophunksv67_attributes.json',
  'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/data/data/cryptophunksv67_attributes.json',
  'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/static/data/cryptophunksv67_attributes.json',
];

console.log('=== URL checks ===');
for (const url of urls) {
  const res = await fetch(url, { method: 'HEAD' });
  console.log(`HTTP ${res.status} — ${url.replace('https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/','')}`);
}

// Full mismatch details for og-missing-phunks
console.log('\n=== og-missing-phunks mismatches ===');
const { data: items } = await sb.from('ethscriptions').select('hashId, tokenId, sha').eq('slug', 'og-missing-phunks');

async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return (await res.json()).result;
}

const mismatches = [];
for (const item of items) {
  const tx = await rpc('eth_getTransactionByHash', [item.hashId]);
  if (!tx) { console.log(`#${item.tokenId}: NO TX`); continue; }
  const onChainSha = createHash('sha256').update(Buffer.from(tx.input.slice(2), 'hex')).digest('hex');
  if (onChainSha !== item.sha) {
    mismatches.push({ tokenId: item.tokenId, hashId: item.hashId, dbSha: item.sha, correctSha: onChainSha });
    console.log(`#${item.tokenId}: DB=${item.sha} → correct=${onChainSha}`);
  }
}
console.log(`\nTotal mismatches: ${mismatches.length}`);
