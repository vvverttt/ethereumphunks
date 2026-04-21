import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

const hashId = '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d';

// Check all likely tables
const tables = ['events', 'activity', 'listings', 'bids', 'transfers', 'sales', 'offers'];
for (const table of tables) {
  try {
    const { data, error } = await sb.from(table).select('*').eq('hashId', hashId).limit(5);
    if (!error) console.log(`${table}: ${data?.length} rows`);
    else console.log(`${table}: error - ${error.message}`);
  } catch(e) {
    console.log(`${table}: exception - ${e.message}`);
  }
}
