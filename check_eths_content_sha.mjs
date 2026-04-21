import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

// Check a sample of normal v67 items + the 3 reverted ones
const { data: sample } = await sb.from('ethscriptions').select('hashId, tokenId, sha')
  .eq('slug', 'cryptophunksv67').in('tokenId', [1, 2, 3, 100, 1569, 2103, 3719]);

for (const item of sample) {
  const res = await fetch(`https://api.ethscriptions.com/api/ethscriptions/${item.hashId}`);
  if (res.status !== 200) { console.log(`#${item.tokenId}: HTTP ${res.status} (not indexed)`); continue; }
  const data = await res.json();
  const eth = data.ethscription ?? data;
  const apiSha = eth.content_sha ?? eth.sha;
  console.log(`#${item.tokenId}: DB=${item.sha?.slice(0,12)} API=${apiSha?.slice(0,12)} match=${apiSha === item.sha ? '✓' : '✗'}`);
  await new Promise(r => setTimeout(r, 200));
}
