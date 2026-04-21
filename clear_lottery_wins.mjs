import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

// Count first
const { count } = await sb.from('lottery_wins').select('*', { count: 'exact', head: true });
console.log(`Found ${count} rows in lottery_wins`);

// Delete all (use gt id 0 trick since delete requires a filter)
const { error, count: deleted } = await sb.from('lottery_wins').delete({ count: 'exact' }).gte('id', 0);
if (error) {
  // Try with created_at filter if no id column
  const { error: e2, count: d2 } = await sb.from('lottery_wins').delete({ count: 'exact' }).not('created_at', 'is', null);
  if (e2) console.log('Error:', e2.message);
  else console.log(`Deleted ${d2} rows ✓`);
} else {
  console.log(`Deleted ${deleted} rows ✓`);
}

console.log('\nDone!');
