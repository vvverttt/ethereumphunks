/**
 * Fix "created" events — from should be creator address, not zero address
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'REDACTED_SUPABASE_SERVICE_ROLE';

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
