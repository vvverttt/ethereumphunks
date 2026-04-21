import { createClient } from '@supabase/supabase-js';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

const STATIC_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/static/images';
const OUT_DIR = './images_by_collection';

// Fetch all ethscriptions with sha + slug + tokenId
console.log('Fetching all ethscriptions...');
let allItems = [];
let from = 0;
const PAGE = 1000;
while (true) {
  const { data, error } = await sb.from('ethscriptions')
    .select('sha, slug, tokenId')
    .not('sha', 'is', null)
    .order('tokenId', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) { console.error(error.message); break; }
  if (!data?.length) break;
  allItems.push(...data);
  console.log(`  fetched ${allItems.length} so far...`);
  if (data.length < PAGE) break;
  from += PAGE;
}

// Group by slug
const bySlug = {};
for (const item of allItems) {
  if (!item.sha) continue;
  const slug = item.slug || 'unknown';
  if (!bySlug[slug]) bySlug[slug] = [];
  bySlug[slug].push(item);
}

console.log(`\nCollections found:`);
for (const [slug, items] of Object.entries(bySlug)) {
  console.log(`  ${slug}: ${items.length} items`);
}

// Download images
console.log(`\nDownloading to ${OUT_DIR}/`);
mkdirSync(OUT_DIR, { recursive: true });

for (const [slug, items] of Object.entries(bySlug)) {
  const folder = join(OUT_DIR, slug);
  mkdirSync(folder, { recursive: true });

  let done = 0, skipped = 0, failed = 0;
  for (const item of items) {
    const filename = `${item.tokenId}.png`;
    const filepath = join(folder, filename);
    if (existsSync(filepath)) { skipped++; done++; continue; }

    try {
      const res = await fetch(`${STATIC_URL}/${item.sha}`);
      if (!res.ok) { failed++; done++; continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(filepath, buf);
      done++;
      if (done % 100 === 0) process.stdout.write(`\r  [${slug}] ${done}/${items.length}...`);
    } catch {
      failed++;
      done++;
    }
  }
  console.log(`\r  [${slug}] done: ${items.length - failed} saved, ${skipped} skipped, ${failed} failed`);
}

console.log('\nDone!');
