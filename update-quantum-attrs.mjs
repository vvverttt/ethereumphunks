import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const missingJson = JSON.parse(readFileSync('./marketplace/src/missingand quantumupdates/quantummissingphunksv677.json', 'utf8'));
const dystoJson   = JSON.parse(readFileSync('./marketplace/src/missingand quantumupdates/quantumdystophunkszv677.json', 'utf8'));

// Build tokenId → newSha map and slug map
const tokenUpdates = [
  ...missingJson.map(t => ({ tokenId: t.number, newSha: t.sha, slug: 'quantummissingphunksv67' })),
  ...dystoJson.map(t => ({ tokenId: t.number, newSha: t.sha, slug: 'quantumdystophunkzv67' })),
];

async function main() {
  console.log('Updating attributes_new sha for 23 tokens...\n');
  let ok = 0, failed = 0;

  for (const { tokenId, newSha, slug } of tokenUpdates) {
    const { error } = await supabase
      .from('attributes_new')
      .update({ sha: newSha })
      .eq('tokenId', tokenId)
      .eq('slug', slug);

    if (error) {
      console.error(`❌ #${tokenId} [${slug}]: ${error.message}`);
      failed++;
    } else {
      console.log(`✅ #${tokenId} [${slug}] → sha ${newSha.slice(0,16)}...`);
      ok++;
    }
  }

  console.log(`\nDone: ${ok} updated, ${failed} failed`);
}

main().catch(console.error);
