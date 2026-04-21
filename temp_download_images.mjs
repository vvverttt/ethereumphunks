import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { createWriteStream } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { exec } from 'child_process';
const execAsync = promisify(exec);

const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

const SLUGS = ['cryptophunksv67', 'quantummissingphunksv67', 'quantumdystophunkzv67'];
const BASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co/storage/v1/object/public/static/images';
const OUT_DIR = path.resolve('./images_by_number');

if (existsSync(OUT_DIR)) await rm(OUT_DIR, { recursive: true });
await mkdir(OUT_DIR, { recursive: true });

let total = 0, failed = 0;

for (const slug of SLUGS) {
  let data = [], from = 0, pageSize = 1000;
  while (true) {
    const { data: page, error } = await sb.from('ethscriptions')
      .select('tokenId, sha')
      .eq('slug', slug)
      .order('tokenId')
      .range(from, from + pageSize - 1);
    if (error) { console.error(`Error fetching ${slug}:`, error.message); break; }
    data.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  console.log(`\n${slug}: ${data.length} tokens`);

  for (const { tokenId, sha } of data) {
    try {
      const res = await fetch(`${BASE_URL}/${sha}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // Detect format
      let ext = '.png';
      if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) ext = '.gif';
      else if (buf[0] === 0xFF && buf[1] === 0xD8) ext = '.jpg';
      else if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) ext = '.webp';
      await writeFile(path.join(OUT_DIR, `${sha}${ext}`), buf);
      process.stdout.write(`  ✅ #${tokenId} → ${sha.slice(0,12)}...${ext}   \r`);
      total++;
    } catch (e) {
      console.error(`  ❌ #${tokenId}: ${e.message}`);
      failed++;
    }
  }
  console.log(`  Done ${slug}`);
}

console.log(`\n\nDownloaded ${total} images${failed > 0 ? `, ${failed} failed` : ''}`);

// Zip using PowerShell
const zipPath = path.resolve('./images_by_number.zip');
if (existsSync(zipPath)) await rm(zipPath);
console.log('Zipping...');
await execAsync(`powershell -Command "Compress-Archive -Path '${OUT_DIR}\\*' -DestinationPath '${zipPath}'"`)
console.log(`Saved: ${zipPath} ✅`);
