import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

let all = [], from = 0;
while (true) {
  const { data } = await sb.from('ethscriptions').select('slug').range(from, from + 999);
  if (!data?.length) break;
  all = all.concat(data);
  from += 1000;
  if (data.length < 1000) break;
}

const counts = {};
for (const r of all) counts[r.slug || 'null'] = (counts[r.slug || 'null'] || 0) + 1;
console.log('Total:', all.length);
console.log(counts);
