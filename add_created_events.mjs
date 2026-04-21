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

const OWNER = '0xea04f65f9dc5917302532859d80fcf36a15de266';

const items = [
  { tokenId: 1569, hash: '0x3402ecf21d817a8e648f1786cd9a65cc04db2bf231b1990f23681e9878d0a2b2', block: 24668293 },
  { tokenId: 2103, hash: '0xce4222491cb09aa238d19f3a71c388a46f2ecc45f04cea4f63ee796029f7ec56', block: 24668298 },
  { tokenId: 3080, hash: '0xa1a5a3a32c20d4984026c35db6989745da83909e5b8acb55eb1ad76d38421c2d', block: 24668300 },
  { tokenId: 3719, hash: '0xc3b617e29be433bf711ce70f3c0cb534421c0f561f0c81322ce08c62bcd58ffb', block: 24668305 },
  { tokenId: 8663, hash: '0x53083c7f14a5233befb6933a12eeba8012a126ede10a0435358b1befd2c11af4', block: 24668313 },
  { tokenId: 8699, hash: '0x2e232e6a9edab1de6667a09b66a46e3cdceebf6455bd71748dae37793acd69bf', block: 24668313 },
  { tokenId: 9360, hash: '0x85f349d41feaf21d6efe953bf52147598a18a219364f169a4abd730bf6ae4092', block: 24668313 },
  { tokenId: 9363, hash: '0x091f594cdb17c1a1417e4b3a1c9dce06c7957a558609d87c840318c365da3e44', block: 24668320 },
];

console.log('=== Fetching block data ===');
// Get block data for each unique block
const blockNums = [...new Set(items.map(i => i.block))];
const blockData = {};
for (const b of blockNums) {
  const block = await rpc('eth_getBlockByNumber', ['0x' + b.toString(16), false]);
  if (block) {
    blockData[b] = {
      hash: block.hash,
      timestamp: parseInt(block.timestamp, 16),
    };
    console.log(`  block ${b}: hash=${block.hash.slice(0,14)} ts=${new Date(parseInt(block.timestamp,16)*1000).toISOString()}`);
  }
}

console.log('\n=== Fetching tx data ===');
const txData = {};
for (const item of items) {
  const tx = await rpc('eth_getTransactionByHash', [item.hash]);
  if (tx) {
    txData[item.hash] = { index: parseInt(tx.transactionIndex, 16) };
    console.log(`  #${item.tokenId}: txIndex=${parseInt(tx.transactionIndex, 16)}`);
  }
}

console.log('\n=== Inserting created events ===');
for (const item of items) {
  const block = blockData[item.block];
  const tx = txData[item.hash];
  if (!block || !tx) { console.log(`  #${item.tokenId}: missing block or tx data`); continue; }

  const ts = new Date(block.timestamp * 1000).toISOString();
  const txId = item.hash + tx.index.toString(16).padStart(2, '0');

  // Check if event already exists
  const { data: existing } = await sb.from('events').select('hashId').eq('hashId', item.hash).eq('type', 'created');
  if (existing?.length) {
    console.log(`  #${item.tokenId}: event already exists`);
    continue;
  }

  const event = {
    hashId: item.hash,
    from: OWNER,
    to: OWNER,
    blockHash: block.hash,
    txHash: item.hash,
    blockNumber: item.block,
    blockTimestamp: ts,
    type: 'created',
    value: '0',
    txId,
    txIndex: tx.index,
  };

  const { error } = await sb.from('events').insert(event);
  if (error) console.log(`  #${item.tokenId}: insert error: ${error.message}`);
  else console.log(`  #${item.tokenId}: created event inserted ✓`);
}

// Also update createdAt on the ethscription rows
console.log('\n=== Updating createdAt on ethscriptions ===');
for (const item of items) {
  const { error } = await sb.from('ethscriptions').update({ createdAt: item.block }).eq('hashId', item.hash);
  if (error) console.log(`  #${item.tokenId}: createdAt update error: ${error.message}`);
  else console.log(`  #${item.tokenId}: createdAt=${item.block} ✓`);
}

console.log('\nDone!');
