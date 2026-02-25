/**
 * Fix created events: swap from/to so that event.to = creator
 * The frontend shows event.to as "Created by", but our rebuild script
 * set from=creator, to=initial_owner — so the display is wrong.
 *
 * Fix: set from=0x0, to=creator for all "created" events in OG collections.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs';
const ETHSCRIPTIONS_API = 'https://api.ethscriptions.com/v2';

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function fetchCreator(hashId, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${ETHSCRIPTIONS_API}/ethscriptions/${hashId}`);
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!res.ok) return null;
      const data = await res.json();
      return data.result?.creator?.toLowerCase() || null;
    } catch (err) {
      if (attempt < retries - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

async function fixCreatedEvents(slug) {
  console.log(`\n=== Fixing created events for ${slug} ===`);

  // Get all hashIds for this collection
  const { data: items, error: fetchErr } = await sb
    .from('ethscriptions')
    .select('hashId,tokenId,creator')
    .eq('slug', slug)
    .order('tokenId', { ascending: true });

  if (fetchErr) {
    console.error('Failed to fetch items:', fetchErr);
    return;
  }

  console.log(`Found ${items.length} items`);

  // Get all created events for these items
  const hashIds = items.map(i => i.hashId);
  let createdEvents = [];
  for (let i = 0; i < hashIds.length; i += 50) {
    const batch = hashIds.slice(i, i + 50);
    const { data: events } = await sb
      .from('events')
      .select('*')
      .in('hashId', batch)
      .eq('type', 'created');
    if (events) createdEvents.push(...events);
  }

  console.log(`Found ${createdEvents.length} created events to fix`);

  // Build a map of hashId -> creator from ethscriptions table
  const creatorMap = {};
  for (const item of items) {
    creatorMap[item.hashId.toLowerCase()] = item.creator?.toLowerCase();
  }

  let fixed = 0;
  let needApi = 0;

  for (let i = 0; i < createdEvents.length; i++) {
    const evt = createdEvents[i];
    process.stdout.write(`\r  Fixing ${i + 1}/${createdEvents.length}...`);

    let creator = creatorMap[evt.hashId.toLowerCase()];

    // If no creator in DB, fetch from API
    if (!creator || creator === '0x0000000000000000000000000000000000000000') {
      needApi++;
      creator = await fetchCreator(evt.hashId);
      if ((needApi) % 10 === 0) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    if (!creator) {
      console.log(`\n  No creator found for ${evt.hashId}`);
      continue;
    }

    // Update: set to=creator, from=0x0
    const { error: updateErr } = await sb
      .from('events')
      .update({
        from: '0x0000000000000000000000000000000000000000',
        to: creator,
      })
      .eq('txId', evt.txId);

    if (updateErr) {
      console.error(`\n  Update error for ${evt.txId}:`, updateErr.message);
    } else {
      fixed++;
    }
  }

  console.log(`\n  Fixed ${fixed} created events (${needApi} needed API calls)`);
}

async function main() {
  await fixCreatedEvents('og-missing-phunks');
  await fixCreatedEvents('og-dysto-phunks');
  console.log('\nDone!');
}

main().catch(console.error);
