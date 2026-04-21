import { createHash } from 'crypto';
import { readFileSync } from 'fs';

const RPC = 'https://ethereum-rpc.publicnode.com';
const CONCURRENCY = 20;

const raw = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/1 - CryptoPhunksV67.json', 'utf8'));
const items = raw.collection_items;
console.log(`Checking ${items.length} items on-chain...`);

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

async function checkItem(item) {
  const hashId = item.id;
  try {
    const tx = await rpc('eth_getTransactionByHash', [hashId]);
    if (!tx) return { item, status: 'NO_TX' };
    const onChainSha = createHash('sha256').update(Buffer.from(tx.input.slice(2), 'hex')).digest('hex');
    if (onChainSha !== item.sha) return { item, status: 'MISMATCH', onChainSha };
    return { item, status: 'OK' };
  } catch (e) {
    return { item, status: 'ERROR', error: e.message };
  }
}

// Process in batches
let mismatches = 0, noTx = 0, errors = 0, done = 0;
for (let i = 0; i < items.length; i += CONCURRENCY) {
  const batch = items.slice(i, i + CONCURRENCY);
  const results = await Promise.all(batch.map(checkItem));
  for (const r of results) {
    done++;
    if (r.status === 'MISMATCH') {
      mismatches++;
      console.log(`#${r.item.index} MISMATCH: JSON=${r.item.sha} on-chain=${r.onChainSha}`);
    } else if (r.status === 'NO_TX') {
      noTx++;
      console.log(`#${r.item.index} NO_TX: ${r.item.id}`);
    } else if (r.status === 'ERROR') {
      errors++;
      console.log(`#${r.item.index} ERROR: ${r.error}`);
    }
  }
  if (done % 500 === 0 || done === items.length) {
    process.stdout.write(`\r${done}/${items.length} checked — mismatches: ${mismatches}, no_tx: ${noTx}, errors: ${errors}   `);
  }
}

console.log(`\n\nDone. Mismatches: ${mismatches} | No TX: ${noTx} | Errors: ${errors} | Clean: ${items.length - mismatches - noTx - errors}`);
