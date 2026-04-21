import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

// List all buckets
const { data: buckets } = await sb.storage.listBuckets();
console.log('=== Buckets ===');
for (const b of buckets) console.log(` ${b.name} (public: ${b.public})`);

// List top-level folders/files in each bucket
for (const b of buckets) {
  console.log(`\n=== ${b.name} ===`);
  const { data: root } = await sb.storage.from(b.name).list('', { limit: 100 });
  if (!root?.length) { console.log('  (empty)'); continue; }
  for (const item of root) {
    if (item.id === null) {
      // folder — list contents
      const { data: sub } = await sb.storage.from(b.name).list(item.name, { limit: 5 });
      console.log(`  ${item.name}/ — ${sub?.length ?? '?'} items (showing first 5):`);
      sub?.slice(0,5).forEach(f => console.log(`    ${f.name}`));
    } else {
      console.log(`  ${item.name}`);
    }
  }
}
