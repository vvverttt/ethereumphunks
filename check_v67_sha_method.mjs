import { createHash } from 'crypto';
import { readFileSync } from 'fs';

const RPC = 'https://ethereum-rpc.publicnode.com';
const CONCURRENCY = 20;

const jsonData = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/1 - CryptoPhunksV67.json', 'utf8'));
const items = jsonData.collection_items;
console.log(`Checking ${items.length} items...`);

async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return (await res.json()).result;
}

let mismatches = [], done = 0;

for (let i = 0; i < items.length; i += CONCURRENCY) {
  const batch = items.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(async item => {
    const tx = await rpc('eth_getTransactionByHash', [item.id]);
    if (!tx) return;
    const utf8 = Buffer.from(tx.input.slice(2), 'hex').toString('utf8').replace(/\x00/g, '');
    const sha = createHash('sha256').update(utf8).digest('hex');
    if (sha !== item.sha) mismatches.push({ tokenId: item.index, jsonSha: item.sha, correctSha: sha });
  }));
  done = Math.min(i + CONCURRENCY, items.length);
  process.stdout.write(`\r${done}/${items.length} — mismatches: ${mismatches.length}   `);
}

console.log(`\n\nMismatches: ${mismatches.length}`);
for (const m of mismatches) {
  console.log(`  #${m.tokenId}: JSON=${m.jsonSha.slice(0,16)} correct=${m.correctSha.slice(0,16)}`);
}
