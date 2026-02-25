/**
 * Fix "created" events — from should be creator address, not zero address
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function fixEvents(slug) {
  console.log(`\n=== Fixing created events for ${slug} ===`);

  // Get all ethscriptions with their creator
  const { data: items, error } = await sb
    .from('ethscriptions')
    .select('hashId,creator')
    .eq('slug', slug);

  if (error) {
    console.error('Failed to fetch:', error);
    return;
  }

  let fixed = 0;
  for (const item of items) {
    const txId = `${item.hashId}-created`;
    const { error: updateErr } = await sb
      .from('events')
      .update({ from: item.creator })
      .eq('txId', txId);

    if (updateErr) {
      console.error(`  Error for ${txId}:`, updateErr.message);
    } else {
      fixed++;
    }
  }

  console.log(`  Fixed ${fixed}/${items.length} created events`);
}

async function main() {
  await fixEvents('og-missing-phunks');
  await fixEvents('og-dysto-phunks');
  console.log('\nDone!');
}

main().catch(console.error);
