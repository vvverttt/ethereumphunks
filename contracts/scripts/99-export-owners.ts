import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
//  Export current ethscription owners from Supabase.
//  Output: scripts/owners.json  { "0x{hashId}": "0x{ownerAddress}", ... }
//
//  Usage:
//    npx hardhat run scripts/99-export-owners.ts
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbnByYmhvb2RtZ2ZocW9qbXFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MTM1NTYsImV4cCI6MjA4OTQ4OTU1Nn0.jum-NTWlLJnxmbxe9foylgrEMhGrhn34IPxd4aiyTSE';
const OUT_FILE     = path.resolve(__dirname, './owners.json');

const SLUGS = ['cryptophunksv67', 'quantummissingphunksv67', 'quantumdystophunkzv67'];

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const ownerMap: Record<string, string> = {};

  for (const slug of SLUGS) {
    console.log(`Fetching owners for ${slug}...`);
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from('ethscriptions')
        .select('"hashId", owner')
        .eq('slug', slug)
        .range(offset, offset + 999);

      if (error) throw error;
      if (!data?.length) break;

      for (const row of data) {
        ownerMap[row.hashId.toLowerCase()] = row.owner.toLowerCase();
      }

      process.stdout.write(`  ${offset + data.length} fetched\r`);
      if (data.length < 1000) break;
      offset += 1000;
    }
    console.log(`  ✓ ${slug}`);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(ownerMap, null, 2), 'utf8');
  console.log(`\n✅  ${Object.keys(ownerMap).length} owners saved to ${OUT_FILE}`);
  console.log('    Now run: npx hardhat run scripts/98-build-merkle.ts');
}

main().catch(err => { console.error(err); process.exit(1); });
