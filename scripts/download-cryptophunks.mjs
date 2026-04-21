import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.BxG4LrAQOckVGBtAMtPUP4qnEpN-ZvTdRy53LEzbWyY';
const SLUG = 'cryptophunksv67';
const OUTPUT_DIR = `C:/Users/alber/OneDrive/Desktop/market/${SLUG}`;
const IMAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/static/images`;

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getAllShas() {
  const shas = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await sb
      .from('attributes_new')
      .select('sha')
      .eq('slug', SLUG)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data.length) break;

    shas.push(...data.map(r => r.sha));
    console.log(`Fetched ${shas.length} SHAs...`);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return [...new Set(shas)];
}

async function download(sha, index, total) {
  const filePath = path.join(OUTPUT_DIR, `${sha}.png`);
  if (existsSync(filePath)) return;

  const url = `${IMAGE_BASE}/${sha}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[${index}/${total}] SKIP ${sha} (${res.status})`);
    return;
  }

  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(filePath, buf);
  console.log(`[${index}/${total}] ${sha}`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`Querying ${SLUG}...`);

  const shas = await getAllShas();
  console.log(`Total: ${shas.length} images`);

  for (let i = 0; i < shas.length; i++) {
    await download(shas[i], i + 1, shas.length);
  }

  console.log(`Done! Saved to ${OUTPUT_DIR}`);
}

main().catch(console.error);
