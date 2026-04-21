import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

const BASE = 'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/data';

const slugs = [
  'cryptophunksv67',
  'ethsrock',
  'og-dysto-phunks',
  'og-missing-phunks',
  'quantumdystophunkzv67',
  'quantummissingphunksv67',
];

// Fetch all ethscriptions SHAs per slug
let all = [], from = 0;
while (true) {
  const { data } = await sb.from('ethscriptions').select('slug, sha').range(from, from + 999);
  if (!data?.length) break;
  all = all.concat(data);
  from += 1000;
  if (data.length < 1000) break;
}
const sbBySLug = {};
for (const r of all) {
  if (!sbBySLug[r.slug]) sbBySLug[r.slug] = new Set();
  sbBySLug[r.slug].add(r.sha);
}

for (const slug of slugs) {
  const url = `${BASE}/${slug}_attributes.json`;
  const res = await fetch(url);
  if (res.status !== 200) { console.log(`${slug}: ✗ FILE MISSING (HTTP ${res.status})`); continue; }

  const attrData = await res.json();
  const attrShas = new Set(Object.keys(attrData));
  const dbShas = sbBySLug[slug] || new Set();

  const missingFromFile = [...dbShas].filter(s => !attrShas.has(s));
  const extraInFile = [...attrShas].filter(s => !dbShas.has(s));

  console.log(`\n${slug}:`);
  console.log(`  DB shas: ${dbShas.size} | File shas: ${attrShas.size}`);
  console.log(`  In DB but missing from file: ${missingFromFile.length}`);
  console.log(`  In file but not in DB: ${extraInFile.length}`);
  if (missingFromFile.length) console.log(`  Missing:`, missingFromFile.slice(0,3));
  if (extraInFile.length) console.log(`  Extra:`, extraInFile.slice(0,3));
}
