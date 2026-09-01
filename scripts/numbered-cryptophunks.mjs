import { createClient } from '@supabase/supabase-js';
import { copyFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_ANON_KEY = (process.env.SUPABASE_KEY || '');
const SLUG = 'cryptophunksv67';
const SHA_DIR = `C:/Users/alber/OneDrive/Desktop/market/${SLUG}`;
const NUM_DIR = `C:/Users/alber/OneDrive/Desktop/market/${SLUG}-numbered`;

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getAllIndexedShas() {
  const rows = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await sb
      .from('ethscriptions')
      .select('sha, tokenId')
      .eq('slug', SLUG)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data.length) break;

    rows.push(...data);
    console.log(`Fetched ${rows.length} records...`);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function main() {
  await mkdir(NUM_DIR, { recursive: true });

  const rows = await getAllIndexedShas();
  console.log(`Total: ${rows.length}`);

  let copied = 0, skipped = 0, missing = 0;

  for (const { sha, tokenId } of rows) {
    const index = tokenId;
    const src = path.join(SHA_DIR, `${sha}.png`);
    const dest = path.join(NUM_DIR, `${index}.png`);

    if (!existsSync(src)) { missing++; continue; }
    if (existsSync(dest)) { skipped++; continue; }

    await copyFile(src, dest);
    copied++;
    if (copied % 500 === 0) console.log(`Copied ${copied}...`);
  }

  console.log(`Done! Copied: ${copied}, Skipped: ${skipped}, Missing: ${missing}`);
  console.log(`Saved to ${NUM_DIR}`);
}

main().catch(console.error);
