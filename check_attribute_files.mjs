import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

// Get all distinct slugs
const { data: slugRows } = await sb.from('ethscriptions').select('slug').neq('slug', null);
const slugs = [...new Set(slugRows.map(r => r.slug))].sort();
console.log('Slugs in DB:', slugs);

// List data bucket root
const { data: dataFiles } = await sb.storage.from('data').list('', { limit: 100 });
const dataRoot = dataFiles.map(f => f.name);
console.log('\ndata bucket root:', dataRoot);

// List static/data subfolder
const { data: staticDataFiles } = await sb.storage.from('static').list('data', { limit: 100 });
const staticData = staticDataFiles?.map(f => f.name) ?? [];
console.log('\nstatic/data subfolder:', staticData);

// Check each slug
console.log('\n=== Per slug ===');
for (const slug of slugs) {
  const filename = `${slug}_attributes.json`;
  const inDataRoot = dataRoot.includes(filename);
  const inStaticData = staticData.includes(filename);
  const url = `https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/data/${filename}`;
  const res = await fetch(url, { method: 'HEAD' });
  console.log(`${slug}: data_root=${inDataRoot ? '✓' : '✗'} static/data=${inStaticData ? '✓' : '✗'} HTTP=${res.status}`);
}
