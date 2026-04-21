import { createHash } from 'crypto';
import { readFileSync } from 'fs';

const RPC = 'https://ethereum-rpc.publicnode.com';
const jsonPath = 'C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/ogmissingphunks/missing-phunks (4).json';
const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
const items = raw.collection_items ?? raw;
console.log(`JSON items: ${items.length}`);
console.log('Sample item keys:', Object.keys(items[0]));

async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return (await res.json()).result;
}

// Check first 5 and the 10 known mismatches
const mismatchTokenIds = new Set([10007,10013,10032,10033,10071,10169,10178,10189,10196,10197]);
const toCheck = items.filter(x => mismatchTokenIds.has(x.index ?? x.tokenId ?? x.token_id));

console.log(`\nChecking ${toCheck.length} mismatched items:`);
for (const item of toCheck) {
  const hashId = item.id ?? item.hashId;
  const jsonSha = item.sha;
  const tokenId = item.index ?? item.tokenId;

  const tx = await rpc('eth_getTransactionByHash', [hashId]);
  if (!tx) { console.log(`#${tokenId}: NO TX`); continue; }
  const onChainSha = createHash('sha256').update(Buffer.from(tx.input.slice(2), 'hex')).digest('hex');

  console.log(`#${tokenId}: JSON=${jsonSha?.slice(0,12)} onchain=${onChainSha.slice(0,12)} ${jsonSha === onChainSha ? '✓ match' : jsonSha ? '✗ mismatch' : 'no sha in json'}`);
}
