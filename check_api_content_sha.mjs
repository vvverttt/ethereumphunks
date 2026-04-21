import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

const { data: items } = await sb.from('ethscriptions').select('hashId, tokenId, sha')
  .eq('slug', 'og-missing-phunks').in('tokenId', [10007, 10013, 10169]);

for (const item of items) {
  const res = await fetch(`https://api.ethscriptions.com/api/ethscriptions/${item.hashId}`);
  if (res.status !== 200) { console.log(`#${item.tokenId}: HTTP ${res.status}`); continue; }
  const data = await res.json();
  const eth = data.ethscription ?? data;
  console.log(`#${item.tokenId}:`);
  console.log(`  DB sha:       ${item.sha}`);
  console.log(`  content_sha:  ${eth.content_sha}`);
  console.log(`  match:        ${eth.content_sha === item.sha ? '✓' : '✗'}`);
  await new Promise(r => setTimeout(r, 300));
}
