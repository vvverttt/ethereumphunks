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
  .eq('slug', 'og-missing-phunks').in('tokenId', [10007, 10169]);

for (const item of items) {
  const tx = await rpc('eth_getTransactionByHash', [item.hashId]);
  const inputBytes = Buffer.from(tx.input.slice(2), 'hex');
  const str = inputBytes.toString('utf8');
  const base64match = str.match(/^data:[^;]+;base64,(.+)$/s);
  const base64str = base64match?.[1] ?? '';
  const imgBytes = base64match ? Buffer.from(base64str, 'base64') : Buffer.alloc(0);

  const methods = {
    'SHA(raw bytes)':           createHash('sha256').update(inputBytes).digest('hex'),
    'SHA(utf8 string)':         createHash('sha256').update(str).digest('hex'),
    'SHA(utf8 no nulls)':       createHash('sha256').update(str.replace(/\x00/g,'')).digest('hex'),
    'SHA(base64 string)':       createHash('sha256').update(base64str).digest('hex'),
    'SHA(base64 no whitespace)':createHash('sha256').update(base64str.replace(/\s/g,'')).digest('hex'),
    'SHA(png bytes)':           createHash('sha256').update(imgBytes).digest('hex'),
    'SHA(png utf8)':            createHash('sha256').update(imgBytes.toString('utf8')).digest('hex'),
  };

  console.log(`\n#${item.tokenId} — target: ${item.sha}`);
  for (const [name, sha] of Object.entries(methods)) {
    console.log(`  ${sha === item.sha ? '✓ MATCH' : '      '} ${name}: ${sha.slice(0,16)}...`);
  }
}
