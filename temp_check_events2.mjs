import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

// Simple check - one hashId at a time
const checks = [
  { hashId: '0x10aef8ca7bbb020e62204b273f958b3f0a6c524ee9ccf24a7ea8163b23b6e4a6', tokenId: 10093 },
  { hashId: '0xa62831366cceaf8e3a8c528696ec9b5d36685bfa7d54afffdc08f3a812fbe87c', tokenId: 10004 },
  { hashId: '0x413f30c0b85bd3a787b40a8b4152fa3a40c1362525a0ad4620eecaf098ba67e4', tokenId: 10251 },
];

for (const c of checks) {
  const { data, error } = await sb.from('events').select('type, blockNumber, txHash, from, to').eq('hashId', c.hashId).order('blockNumber');
  console.log(`#${c.tokenId}: ${data?.length ?? 'ERR'} events ${error ? 'ERR:'+error.message : ''}`);
  for (const e of (data||[])) {
    console.log(`  type=${e.type} block=${e.blockNumber} from=${e.from?.slice(0,10)} to=${e.to?.slice(0,10)} txHash=${e.txHash?.slice(0,20)}`);
  }
}

// Also check what the max blockNumber event is now
const { data: latest } = await sb.from('events').select('blockNumber, hashId, type').order('blockNumber', {ascending: false}).limit(5);
console.log('\nLatest 5 events in DB:');
for (const e of (latest||[])) console.log(`  block=${e.blockNumber} type=${e.type} hashId=${e.hashId?.slice(0,22)}`);
