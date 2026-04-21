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

const { data: items } = await sb.from('ethscriptions').select('hashId, tokenId, sha')
  .eq('slug', 'og-missing-phunks').in('tokenId', [10007, 10013, 10169]);

for (const item of items) {
  const tx = await rpc('eth_getTransactionByHash', [item.hashId]);
  const inputBytes = Buffer.from(tx.input.slice(2), 'hex');

  // Method 1: SHA256 of raw bytes
  const sha1 = createHash('sha256').update(inputBytes).digest('hex');
  // Method 2: SHA256 of UTF-8 string (how indexer does it)
  const strData = inputBytes.toString('utf8').replace(/\x00/g, '');
  const sha2 = createHash('sha256').update(strData).digest('hex');

  console.log(`#${item.tokenId}:`);
  console.log(`  DB:           ${item.sha}`);
  console.log(`  SHA(bytes):   ${sha1} ${sha1 === item.sha ? '✓' : ''}`);
  console.log(`  SHA(string):  ${sha2} ${sha2 === item.sha ? '✓' : ''}`);
}
