import { createHash } from 'crypto';

const RPC = 'https://ethereum-rpc.publicnode.com';

const items = [
  { tokenId: 10169, hashId: '0x' }, // need hashId
];

async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return (await res.json()).result;
}

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

// Get a few mismatched items
const tokenIds = [10169, 10007, 10013];
const { data } = await sb.from('ethscriptions').select('hashId, tokenId, sha').eq('slug', 'og-missing-phunks').in('tokenId', tokenIds);

for (const item of data) {
  const tx = await rpc('eth_getTransactionByHash', [item.hashId]);
  const inputBytes = Buffer.from(tx.input.slice(2), 'hex');
  const inputStr = inputBytes.toString('utf8').slice(0, 60);

  // SHA of full input
  const shaFull = createHash('sha256').update(inputBytes).digest('hex');

  // If data URI — try SHA of just the image bytes
  let shaImageOnly = null;
  const match = inputBytes.toString('utf8').match(/^data:[^;]+;base64,(.+)$/s);
  if (match) {
    const imgBytes = Buffer.from(match[1], 'base64');
    shaImageOnly = createHash('sha256').update(imgBytes).digest('hex');
  }

  console.log(`\n#${item.tokenId}`);
  console.log(`  input prefix: ${inputStr}`);
  console.log(`  DB sha:        ${item.sha}`);
  console.log(`  SHA(full):     ${shaFull}  ${shaFull === item.sha ? '✓ MATCH' : ''}`);
  console.log(`  SHA(img only): ${shaImageOnly}  ${shaImageOnly === item.sha ? '✓ MATCH' : ''}`);
}
