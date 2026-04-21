import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

const NEW_HASHIDS = [
  '0xa62831366cceaf8e3a8c528696ec9b5d36685bfa7d54afffdc08f3a812fbe87c',
  '0xc13c9446b70ed7b40b2f379305c0587a669b36cd44c97f51fcaa1bbad6f41a2b',
  '0x872d06f01dedd8c820dc136c2d817e24b623a70526a1c8acd5c923239ef31646',
  '0x632f46a2880e85c86eadb867c76262a7c5df4cc0763d4fc851dd542f82b326ab',
  '0x10aef8ca7bbb020e62204b273f958b3f0a6c524ee9ccf24a7ea8163b23b6e4a6',
  '0xad6f4303eb6b70301da8fd3e261bd9943878c609603af98c8027c7956e08d6f1',
  '0x31b478578539e973101ad77db1e4556ebb46b298f36c4f170a5b37d093d79d32',
  '0x8b44334a95310db60e84bdcfe8332330623746dccffc915ab0011e7a309823aa',
  '0x413f30c0b85bd3a787b40a8b4152fa3a40c1362525a0ad4620eecaf098ba67e4',
  '0x3439136078e5d3cbf059a9d66088100d6efea41f845e4f1949c705915b2a8225',
  '0x92778fcc6975840b06c7d843b84e0ae3af2bef4d1fb0c208f1fcb4c309668b90',
  '0xbcb6fc2e03fb9cb8ff6b92420d1efeeee96c172a346488fe21413c1cabe90a35',
  '0xbddf579de6472ae8eed7a435ca395111ea86cd51de80aa653efa44bb24120285',
  '0xec86ed520cda11af33aff0bf8d977510f0ff850819828895133910e6fa7dbe69',
  '0xaa04d65f69d28e1b724f0b715fd7dea5cb802b292f2390de154dea5d843e2377',
  '0xb9f56a93e45b4fccfb7109dcab2d76c5df67d64aac4a5a2af2a6dde707aba25f',
  '0x0b1d7d2bdb9896a75bdc70ee1489e012b79cbe84b30e982c6f54c92f8d70eaad',
  '0x2cd4dafac8cc7755b9579575b8a0ce7e04faee52d83c1964ddaa47f06e991613',
  '0xfaac0f1d76b283db7542e7877984ae1580dc4f721def628915f7f7c592298614',
  '0xd74cec8aeba3b4d3d5944678e14a5225f1f58dca2df2d22f7d56e691faca80e2',
  '0x544b706aaf19afd73b8dabaca03fbd4e80de98ab7f0865d6c5a8317da3cbbda3',
  '0xd61c2419d8947a60a624924711d6f0ef361aed551326370f96fe5facd4c7b766',
  '0x0d2594fa174377c84f219237498968a45df3e6e59e205970a6439eb670a23043',
];

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

// First, audit what exists for each token
console.log('=== AUDIT BEFORE CLEANUP ===');
for (const hashId of NEW_HASHIDS) {
  const tokenId = TOKEN_MAP[hashId];
  const { data: evts, error } = await sb.from('events')
    .select('type, blockNumber, txHash')
    .eq('hashId', hashId)
    .order('blockNumber');
  if (error) { console.log(`#${tokenId} SELECT ERROR: ${error.message}`); continue; }
  console.log(`#${tokenId}: ${evts?.length ?? 0} events`);
  for (const e of (evts || [])) {
    console.log(`  - ${e.type} @ block ${e.blockNumber}`);
  }
}

console.log('\n=== CLEANING EVENTS ===');
// Strategy: for each hashId, delete events that are NOT:
//   1. type = 'created'
//   2. blockNumber = 24655712 (current batch deposit)
let totalDeleted = 0;

for (const hashId of NEW_HASHIDS) {
  const tokenId = TOKEN_MAP[hashId];

  // Delete all events for this hashId where type != 'created' AND blockNumber != 24655712
  const { error, count } = await sb.from('events')
    .delete({ count: 'exact' })
    .eq('hashId', hashId)
    .neq('type', 'created')
    .neq('blockNumber', 24655712);

  if (error) {
    console.log(`#${tokenId} DELETE ERROR: ${error.message}`);
    continue;
  }
  console.log(`#${tokenId}: deleted ${count ?? 0} events`);
  totalDeleted += (count ?? 0);
}

console.log(`\nTotal deleted: ${totalDeleted}`);

// Final audit
console.log('\n=== FINAL STATE ===');
for (const hashId of NEW_HASHIDS) {
  const tokenId = TOKEN_MAP[hashId];
  const { data: evts } = await sb.from('events')
    .select('type, blockNumber')
    .eq('hashId', hashId)
    .order('blockNumber');
  const summary = (evts || []).map(e => `${e.type}@${e.blockNumber}`).join(', ');
  const ok = evts?.length >= 2 && evts.some(e => e.type === 'created') && evts.some(e => e.blockNumber === 24655712);
  console.log(`#${tokenId}: [${summary}] ${ok ? '✅' : '❌'}`);
}
