import { createClient } from '@supabase/supabase-js';
const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);
const NEW_HASHIDS = [
  '0xa62831366cceaf8e3a8c528696ec9b5d36685bfa7d54afffdc08f3a812fbe87c', // 10004
  '0x0d2594fa174377c84f219237498968a45df3e6e59e205970a6439eb670a23043', // 10312
];
// Check most recent event for these tokens
const { data } = await sb.from('events').select('hashId, type, blockNumber, from, to').in('hashId', NEW_HASHIDS).order('blockNumber', { ascending: false }).limit(10);
for (const ev of (data||[])) {
  console.log(`hashId=${ev.hashId?.slice(0,20)} type=${ev.type} block=${ev.blockNumber} from=${ev.from?.slice(0,10)} to=${ev.to?.slice(0,10)}`);
}
// Check owner in ethscriptions
const { data: eths } = await sb.from('ethscriptions').select('tokenId, hashId, owner, slug').in('hashId', NEW_HASHIDS);
for (const e of (eths||[])) {
  console.log(`#${e.tokenId} ${e.slug} owner=${e.owner}`);
}
