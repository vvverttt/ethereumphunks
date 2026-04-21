import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

const RPCS = [
  'https://rpc.mevblocker.io',
  'https://1rpc.io/eth',
  'https://eth.llamarpc.com',
  'https://ethereum-rpc.publicnode.com',
];

async function rpcCall(rpc, method, params) {
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json();
    return json.result || null;
  } catch {
    return null;
  }
}

async function getTx(hash) {
  for (const rpc of RPCS) {
    const tx = await rpcCall(rpc, 'eth_getTransactionByHash', [hash]);
    if (tx && tx.blockNumber) return { tx, rpc };
  }
  return null;
}

async function getBlock(blockHex, preferredRpc) {
  const rpcs = preferredRpc ? [preferredRpc, ...RPCS.filter(r => r !== preferredRpc)] : RPCS;
  for (const rpc of rpcs) {
    const block = await rpcCall(rpc, 'eth_getBlockByNumber', [blockHex, false]);
    if (block && block.timestamp && parseInt(block.timestamp, 16) > 0) return block;
  }
  return null;
}

const TOKEN_MAP = {
  '0xa62831366cceaf8e3a8c528696ec9b5d36685bfa7d54afffdc08f3a812fbe87c': 10004,
  '0xc13c9446b70ed7b40b2f379305c0587a669b36cd44c97f51fcaa1bbad6f41a2b': 10015,
  '0x872d06f01dedd8c820dc136c2d817e24b623a70526a1c8acd5c923239ef31646': 10058,
  '0x632f46a2880e85c86eadb867c76262a7c5df4cc0763d4fc851dd542f82b326ab': 10078,
  '0x10aef8ca7bbb020e62204b273f958b3f0a6c524ee9ccf24a7ea8163b23b6e4a6': 10093,
  '0xad6f4303eb6b70301da8fd3e261bd9943878c609603af98c8027c7956e08d6f1': 10099,
  '0x31b478578539e973101ad77db1e4556ebb46b298f36c4f170a5b37d093d79d32': 10207,
  '0x8b44334a95310db60e84bdcfe8332330623746dccffc915ab0011e7a309823aa': 10250,
  '0x413f30c0b85bd3a787b40a8b4152fa3a40c1362525a0ad4620eecaf098ba67e4': 10251,
  '0x3439136078e5d3cbf059a9d66088100d6efea41f845e4f1949c705915b2a8225': 10259,
  '0x92778fcc6975840b06c7d843b84e0ae3af2bef4d1fb0c208f1fcb4c309668b90': 10261,
  '0xbcb6fc2e03fb9cb8ff6b92420d1efeeee96c172a346488fe21413c1cabe90a35': 10277,
  '0xbddf579de6472ae8eed7a435ca395111ea86cd51de80aa653efa44bb24120285': 10287,
  '0xec86ed520cda11af33aff0bf8d977510f0ff850819828895133910e6fa7dbe69': 10290,
  '0xaa04d65f69d28e1b724f0b715fd7dea5cb802b292f2390de154dea5d843e2377': 10293,
  '0xb9f56a93e45b4fccfb7109dcab2d76c5df67d64aac4a5a2af2a6dde707aba25f': 10295,
  '0x0b1d7d2bdb9896a75bdc70ee1489e012b79cbe84b30e982c6f54c92f8d70eaad': 10298,
  '0x2cd4dafac8cc7755b9579575b8a0ce7e04faee52d83c1964ddaa47f06e991613': 10299,
  '0xfaac0f1d76b283db7542e7877984ae1580dc4f721def628915f7f7c592298614': 10301,
  '0xd74cec8aeba3b4d3d5944678e14a5225f1f58dca2df2d22f7d56e691faca80e2': 10306,
  '0x544b706aaf19afd73b8dabaca03fbd4e80de98ab7f0865d6c5a8317da3cbbda3': 10307,
  '0xd61c2419d8947a60a624924711d6f0ef361aed551326370f96fe5facd4c7b766': 10308,
  '0x0d2594fa174377c84f219237498968a45df3e6e59e205970a6439eb670a23043': 10312,
};

// Check current state of all 23 created events
console.log('=== CURRENT STATE OF CREATED EVENTS ===');
const allHashIds = Object.keys(TOKEN_MAP);
const needsFix = [];

for (const hashId of allHashIds) {
  const tokenId = TOKEN_MAP[hashId];
  const { data } = await sb.from('events').select('blockNumber, blockTimestamp, from, to').eq('hashId', hashId).eq('type', 'created').single();
  if (!data) { console.log(`#${tokenId}: NO CREATED EVENT`); continue; }
  const ts = data.blockTimestamp;
  const isWrong = !ts || ts.startsWith('1970') || new Date(ts) < new Date('2026-01-01');
  console.log(`#${tokenId}: block=${data.blockNumber} ts=${ts} from=${data.from?.slice(0,16)}... ${isWrong ? '❌ NEEDS FIX' : '✅'}`);
  if (isWrong) needsFix.push(hashId);
}

console.log(`\nNeed to fix: ${needsFix.length} tokens`);

if (needsFix.length === 0) {
  console.log('All good!');
  process.exit(0);
}

console.log('\n=== FIXING WITH MULTI-RPC RETRY ===');
let fixed = 0;

for (const hashId of needsFix) {
  const tokenId = TOKEN_MAP[hashId];

  const result = await getTx(hashId);
  if (!result) {
    console.log(`#${tokenId}: TX NOT FOUND ON ANY RPC ❌`);
    continue;
  }

  const { tx, rpc: usedRpc } = result;
  const blockNum = parseInt(tx.blockNumber, 16);
  const from = tx.from?.toLowerCase();

  const block = await getBlock(tx.blockNumber, usedRpc);
  if (!block) {
    console.log(`#${tokenId}: BLOCK NOT FOUND (block ${blockNum}) ❌`);
    continue;
  }

  const tsUnix = parseInt(block.timestamp, 16);
  const blockTimestamp = new Date(tsUnix * 1000).toISOString();

  console.log(`#${tokenId}: block=${blockNum} ts=${blockTimestamp} from=${from?.slice(0,16)}... [via ${usedRpc.replace('https://','')}]`);

  const { error } = await sb.from('events')
    .update({ blockNumber: blockNum, blockTimestamp, from, to: from })
    .eq('hashId', hashId)
    .eq('type', 'created');

  if (error) {
    console.log(`  UPDATE ERROR: ${error.message}`);
  } else {
    await sb.from('ethscriptions').update({ createdAt: blockTimestamp }).eq('hashId', hashId);
    console.log(`  Updated ✅`);
    fixed++;
  }
}

console.log(`\nFixed: ${fixed} / ${needsFix.length}`);

// Final verification
console.log('\n=== FINAL STATE ===');
for (const hashId of allHashIds) {
  const tokenId = TOKEN_MAP[hashId];
  const { data } = await sb.from('events').select('blockNumber, blockTimestamp').eq('hashId', hashId).eq('type', 'created').single();
  const ts = data?.blockTimestamp;
  const ok = ts && !ts.startsWith('1970') && new Date(ts) >= new Date('2026-01-01');
  console.log(`#${tokenId}: ${ts} ${ok ? '✅' : '❌'}`);
}
