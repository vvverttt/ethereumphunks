import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = 'REDACTED_SUPABASE_SERVICE_ROLE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE = './marketplace/src/missingand quantumupdates';
const DIRS = [
  `${BASE}/quantum_missing_phunks_by_sha`,
  `${BASE}/quantum_dysto_phunks_by_sha`,
];

async function main() {
  let ok = 0, failed = 0;

  for (const dir of DIRS) {
    const files = readdirSync(dir).filter(f => f.endsWith('.png'));
    for (const file of files) {
      const sha = basename(file, '.png');
      const filePath = join(dir, file);
      const data = readFileSync(filePath);

      const { error } = await supabase.storage
        .from('static')
        .upload(`images/${sha}`, data, {
          contentType: 'image/png',
          upsert: true,
        });

      if (error) {
        console.error(`❌ ${sha.slice(0,16)}...: ${error.message}`);
        failed++;
      } else {
        console.log(`✅ images/${sha.slice(0,16)}...`);
        ok++;
      }
    }
  }

  console.log(`\nDone: ${ok} uploaded, ${failed} failed`);
}

main().catch(console.error);
