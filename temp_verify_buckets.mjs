import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public';

// The 23 quantum hashIds
const NEW_HASHIDS = [
  '0xa62831366cceaf8e3a8c528696ec9b5d36685bfa7d54afffdc08f3a812fbe87c', // 10004
  '0xc13c9446b70ed7b40b2f379305c0587a669b36cd44c97f51fcaa1bbad6f41a2b', // 10015
  '0x872d06f01dedd8c820dc136c2d817e24b623a70526a1c8acd5c923239ef31646', // 10058
  '0x632f46a2880e85c86eadb867c76262a7c5df4cc0763d4fc851dd542f82b326ab', // 10078
  '0x10aef8ca7bbb020e62204b273f958b3f0a6c524ee9ccf24a7ea8163b23b6e4a6', // 10093
  '0xad6f4303eb6b70301da8fd3e261bd9943878c609603af98c8027c7956e08d6f1', // 10099
  '0x31b478578539e973101ad77db1e4556ebb46b298f36c4f170a5b37d093d79d32', // 10207
  '0x8b44334a95310db60e84bdcfe8332330623746dccffc915ab0011e7a309823aa', // 10250
  '0x413f30c0b85bd3a787b40a8b4152fa3a40c1362525a0ad4620eecaf098ba67e4', // 10251
  '0x3439136078e5d3cbf059a9d66088100d6efea41f845e4f1949c705915b2a8225', // 10259
  '0x92778fcc6975840b06c7d843b84e0ae3af2bef4d1fb0c208f1fcb4c309668b90', // 10261
  '0xbcb6fc2e03fb9cb8ff6b92420d1efeeee96c172a346488fe21413c1cabe90a35', // 10277
  '0xbddf579de6472ae8eed7a435ca395111ea86cd51de80aa653efa44bb24120285', // 10287
  '0xec86ed520cda11af33aff0bf8d977510f0ff850819828895133910e6fa7dbe69', // 10290
  '0xaa04d65f69d28e1b724f0b715fd7dea5cb802b292f2390de154dea5d843e2377', // 10293
  '0xb9f56a93e45b4fccfb7109dcab2d76c5df67d64aac4a5a2af2a6dde707aba25f', // 10295
  '0x0b1d7d2bdb9896a75bdc70ee1489e012b79cbe84b30e982c6f54c92f8d70eaad', // 10298
  '0x2cd4dafac8cc7755b9579575b8a0ce7e04faee52d83c1964ddaa47f06e991613', // 10299
  '0xfaac0f1d76b283db7542e7877984ae1580dc4f721def628915f7f7c592298614', // 10301
  '0xd74cec8aeba3b4d3d5944678e14a5225f1f58dca2df2d22f7d56e691faca80e2', // 10306
  '0x544b706aaf19afd73b8dabaca03fbd4e80de98ab7f0865d6c5a8317da3cbbda3', // 10307
  '0xd61c2419d8947a60a624924711d6f0ef361aed551326370f96fe5facd4c7b766', // 10308
  '0x0d2594fa174377c84f219237498968a45df3e6e59e205970a6439eb670a23043', // 10312
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

// === 1. Check attribute JSON files in 'data' bucket ===
console.log('=== ATTRIBUTE JSON FILES (data bucket) ===');
const slugs = ['cryptophunksv67', 'quantummissingphunksv67', 'quantumdystophunkzv67'];
for (const slug of slugs) {
  const { data, error } = await sb.storage.from('data').download(`${slug}_attributes.json`);
  if (error) { console.log(`${slug}: ERROR - ${error.message}`); continue; }
  const text = await data.text();
  const json = JSON.parse(text);
  const keys = Object.keys(json);
  console.log(`${slug}_attributes.json: ${keys.length} entries`);
  // Show a few sample keys
  keys.slice(0, 2).forEach(k => console.log(`  key: ${k.slice(0,20)}... -> ${JSON.stringify(json[k][0])}`));
}

// === 2. Get SHAs for the 23 quantum phunks from DB ===
console.log('\n=== DB SHAs FOR 23 QUANTUM PHUNKS ===');
const shaMap = {};
for (const hashId of NEW_HASHIDS) {
  const { data: row } = await sb.from('ethscriptions').select('sha, tokenId').eq('hashId', hashId).single();
  if (row) {
    shaMap[hashId] = row.sha;
    console.log(`#${TOKEN_MAP[hashId]} (${hashId.slice(0,16)}...): sha=${row.sha?.slice(0,20)}...`);
  } else {
    console.log(`#${TOKEN_MAP[hashId]}: NOT FOUND IN ETHSCRIPTIONS`);
  }
}

// === 3. Check images exist in 'static' bucket ===
console.log('\n=== IMAGE CHECK (static bucket, images/) ===');
let missingImages = [];
for (const hashId of NEW_HASHIDS) {
  const sha = shaMap[hashId];
  if (!sha) { console.log(`#${TOKEN_MAP[hashId]}: no sha, skipping`); continue; }
  const { data, error } = await sb.storage.from('static').download(`images/${sha}`);
  if (error) {
    console.log(`#${TOKEN_MAP[hashId]} sha=${sha.slice(0,16)}...: MISSING IMAGE ❌`);
    missingImages.push({ tokenId: TOKEN_MAP[hashId], sha, hashId });
  } else {
    console.log(`#${TOKEN_MAP[hashId]} sha=${sha.slice(0,16)}...: image OK ✅`);
  }
}

if (missingImages.length) {
  console.log(`\n❌ ${missingImages.length} missing images:`);
  missingImages.forEach(m => console.log(`  #${m.tokenId} sha=${m.sha}`));
} else {
  console.log('\nAll 23 images present ✅');
}

// === 4. Check attributes JSON files have the correct SHAs ===
console.log('\n=== ATTRIBUTE SHA COVERAGE CHECK ===');
for (const slug of ['quantummissingphunksv67', 'quantumdystophunkzv67']) {
  const { data } = await sb.storage.from('data').download(`${slug}_attributes.json`);
  const json = JSON.parse(await data.text());
  const attrKeys = Object.keys(json);

  // Find which of our 23 tokens belong to this slug
  const { data: rows } = await sb.from('ethscriptions')
    .select('hashId, sha, tokenId')
    .in('hashId', NEW_HASHIDS)
    .eq('slug', slug);

  console.log(`\n${slug}: ${rows?.length ?? 0} quantum tokens`);
  for (const row of (rows || [])) {
    const hasAttr = attrKeys.includes(row.sha);
    console.log(`  #${row.tokenId} sha=${row.sha?.slice(0,16)}...: ${hasAttr ? 'attr OK ✅' : 'MISSING ATTR ❌'}`);
  }
}
