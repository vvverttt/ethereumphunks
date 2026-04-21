import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

const NEW_HASHIDS = [
  '0xa62831366cceaf8e3a8c528696ec9b5d36685bfa7d54afffdc08f3a812fbe87c', // 10004
  '0xc13c9446b70ed7b40b2f379305c0587a669b36cd44c97f51fcaa1bbad6f41a2b', // 10015
  '0x872d06f01dedd8c820dc136c2d817e24b623a70526a1c8acd5c923239ef31646', // 10058
  '0x632f46a2880e85c86eadb867c76262a7c5df4cc0763d4fc851dd542f82b326ab', // 10078
  '0x10aef8ca7bbb020e62204b273f958b3f0a6c524ee9ccf24a7ea8163b23b6e4a6', // 10093
  '0xad6f4303eb6b70301da8fd3e261bd9943878c609603af98c8027c7956e08d6f1', // 10099
  '0x31b478578539e973101ad77db1e4556ebb46b298f36c4f170a5b37d093d79d32', // 10207
  '0x413f30c0b85bd3a787b40a8b4152fa3a40c1362525a0ad4620eecaf098ba67e4', // 10251 (dysto - had most events)
  '0x92778fcc6975840b06c7d843b84e0ae3af2bef4d1fb0c208f1fcb4c309668b90', // 10261
];

const TOKEN_MAP = {
  '0xa62831366cceaf8e3a8c528696ec9b5d36685bfa7d54afffdc08f3a812fbe87c': 10004,
  '0xc13c9446b70ed7b40b2f379305c0587a669b36cd44c97f51fcaa1bbad6f41a2b': 10015,
  '0x872d06f01dedd8c820dc136c2d817e24b623a70526a1c8acd5c923239ef31646': 10058,
  '0x632f46a2880e85c86eadb867c76262a7c5df4cc0763d4fc851dd542f82b326ab': 10078,
  '0x10aef8ca7bbb020e62204b273f958b3f0a6c524ee9ccf24a7ea8163b23b6e4a6': 10093,
  '0xad6f4303eb6b70301da8fd3e261bd9943878c609603af98c8027c7956e08d6f1': 10099,
  '0x31b478578539e973101ad77db1e4556ebb46b298f36c4f170a5b37d093d79d32': 10207,
  '0x413f30c0b85bd3a787b40a8b4152fa3a40c1362525a0ad4620eecaf098ba67e4': 10251,
  '0x92778fcc6975840b06c7d843b84e0ae3af2bef4d1fb0c208f1fcb4c309668b90': 10261,
};

console.log('=== FULL CREATED EVENT DATA ===');
for (const hashId of NEW_HASHIDS) {
  const tokenId = TOKEN_MAP[hashId];
  const { data: evts } = await sb.from('events')
    .select('*')
    .eq('hashId', hashId)
    .order('blockNumber');

  console.log(`\n#${tokenId} (${hashId.slice(0,20)}...):`);
  for (const e of (evts || [])) {
    console.log(`  type=${e.type} block=${e.blockNumber} ts=${e.blockTimestamp}`);
    console.log(`    from=${e.from}`);
    console.log(`    to=${e.to}`);
    console.log(`    txHash=${e.txHash?.slice(0,30)}...`);
    console.log(`    hashId=${e.hashId?.slice(0,30)}...`);
  }
}
