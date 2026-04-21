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
const CONCURRENCY = 20;

// Fetch all non-cryptophunksv67 items
let all = [], from = 0;
while (true) {
  const { data } = await sb.from('ethscriptions').select('hashId, tokenId, sha, slug')
    .neq('slug', 'cryptophunksv67').range(from, from + 999);
  if (!data?.length) break;
  all = all.concat(data);
  from += 1000;
  if (data.length < 1000) break;
}
console.log(`Checking ${all.length} items (non-cryptophunksv67)...`);

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const { result, error } = await res.json();
  if (error) throw new Error(error.message);
  return result;
}

let mismatches = 0, noTx = 0, errors = 0, done = 0;

for (let i = 0; i < all.length; i += CONCURRENCY) {
  const batch = all.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(async (item) => {
    try {
      const tx = await rpc('eth_getTransactionByHash', [item.hashId]);
      if (!tx) { noTx++; console.log(`${item.slug} #${item.tokenId} NO_TX`); return; }
      const onChainSha = createHash('sha256').update(Buffer.from(tx.input.slice(2), 'hex')).digest('hex');
      if (onChainSha !== item.sha) {
        mismatches++;
        console.log(`${item.slug} #${item.tokenId} MISMATCH: DB=${item.sha.slice(0,12)} onchain=${onChainSha.slice(0,12)}`);
      }
    } catch(e) {
      errors++;
      console.log(`${item.slug} #${item.tokenId} ERROR: ${e.message}`);
    }
    done++;
  }));
  done = i + batch.length;
  process.stdout.write(`\r${done}/${all.length} — mismatches: ${mismatches}, no_tx: ${noTx}, errors: ${errors}   `);
}

console.log(`\n\nDone. Mismatches: ${mismatches} | No TX: ${noTx} | Errors: ${errors} | Clean: ${all.length - mismatches - noTx - errors}`);
