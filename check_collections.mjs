import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

// Check collections table
const tables = ['collections', 'collection', 'slugs'];
for (const t of tables) {
  const { data, error } = await sb.from(t).select('*').limit(20);
  if (!error) {
    console.log(`\n=== ${t} table (${data.length} rows) ===`);
    console.log(JSON.stringify(data, null, 2));
  }
}

// Check distinct slugs across ethscriptions
const { data: slugs } = await sb.from('ethscriptions').select('slug').neq('slug', null);
const distinct = [...new Set(slugs?.map(r => r.slug))].sort();
console.log('\nDistinct slugs in ethscriptions:', distinct);
