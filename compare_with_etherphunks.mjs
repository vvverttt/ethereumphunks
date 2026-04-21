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

// Fetch etherphunks attr file
const theirAttr = await fetch('https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public/data/missing-phunks_attributes.json').then(r=>r.json());
const theirShas = new Set(Object.keys(theirAttr));

// Our JSON
const ourItems = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/ogmissingphunks/missing-phunks (4).json', 'utf8')).collection_items;

// Our DB
const { data: dbItems } = await sb.from('ethscriptions').select('hashId, tokenId, sha').eq('slug', 'og-missing-phunks');
const dbMap = new Map(dbItems.map(r => [r.tokenId, r]));

const mismatchIds = [10007, 10013, 10032, 10033, 10071, 10169, 10178, 10189, 10196, 10197];

console.log('tokenId | our JSON sha       | their sha          | on-chain sha256    | match?');
console.log('--------|--------------------|--------------------|--------------------|---------');

for (const tokenId of mismatchIds) {
  const ourItem = ourItems.find(x => x.index === tokenId);
  const dbRow = dbMap.get(tokenId);
  const tx = await rpc('eth_getTransactionByHash', [ourItem.id]);
  const onChainSha = createHash('sha256').update(Buffer.from(tx.input.slice(2), 'hex').toString('utf8').replace(/\x00/g,'')).digest('hex');

  const theirSha = [...theirShas].find(s => {
    // check if their attr file has an entry for this tokenId by looking at attributes
    return theirAttr[s] && theirAttr[s] === theirAttr[s]; // placeholder
  });

  // Find their sha by checking which sha in their attr matches the on-chain sha
  const theirMatchesOnChain = theirShas.has(onChainSha);
  const theirMatchesOurs = theirShas.has(ourItem.sha);

  console.log(`#${tokenId}: our=${ourItem.sha.slice(0,16)} onchain=${onChainSha.slice(0,16)} theirHasOnchain=${theirMatchesOnChain} theirHasOurs=${theirMatchesOurs}`);
}
