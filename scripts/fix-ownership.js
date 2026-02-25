/**
 * Fix ownership data for OG collections
 * The original import script read data.creator instead of data.result.creator
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const ETHSCRIPTIONS_API = 'https://api.ethscriptions.com/v2';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function fetchOwnership(hashId, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${ETHSCRIPTIONS_API}/ethscriptions/${hashId}`);
      if (res.status === 429) {
        console.log(`  Rate limited, waiting 2s...`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!res.ok) {
        console.log(`  API returned ${res.status} for ${hashId}`);
        return null;
      }
      const data = await res.json();
      const r = data.result;
      return {
        creator: r.creator?.toLowerCase(),
        owner: r.current_owner?.toLowerCase(),
        prevOwner: r.previous_owner?.toLowerCase() || r.creator?.toLowerCase(),
        createdAt: new Date(Number(r.block_timestamp) * 1000).toISOString(),
      };
    } catch (err) {
      console.log(`  Fetch error: ${err.message}`);
      if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

async function fixCollection(slug) {
  console.log(`\n=== Fixing ownership for ${slug} ===`);

  // Get all items with zero addresses
  const { data: items, error } = await sb
    .from('ethscriptions')
    .select('hashId,tokenId')
    .eq('slug', slug)
    .order('tokenId', { ascending: true });

  if (error) {
    console.error('Failed to fetch items:', error);
    return;
  }

  console.log(`Found ${items.length} items to fix`);
  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    process.stdout.write(`\r  Fetching ${i + 1}/${items.length} (#${item.tokenId})...`);

    const ownership = await fetchOwnership(item.hashId);
    if (!ownership) {
      failed++;
      continue;
    }

    const { error: updateErr } = await sb
      .from('ethscriptions')
      .update({
        creator: ownership.creator,
        owner: ownership.owner,
        prevOwner: ownership.prevOwner,
        createdAt: ownership.createdAt,
      })
      .eq('hashId', item.hashId);

    if (updateErr) {
      console.error(`\n  Update error for #${item.tokenId}:`, updateErr.message);
      failed++;
    } else {
      fixed++;
    }

    // Rate limit: pause every 10 requests
    if ((i + 1) % 10 === 0) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\n  Fixed: ${fixed}, Failed: ${failed}`);
}

async function main() {
  await fixCollection('og-missing-phunks');
  await fixCollection('og-dysto-phunks');
  console.log('\nDone!');
}

main().catch(console.error);
