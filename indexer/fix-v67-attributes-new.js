/**
 * fix-v67-attributes-new.js
 *
 * Rebuilds attributes_new for cryptophunksv67 from the storage JSON.
 * The JSON has [{k,v}] format; attributes_new stores flat {Key: Value} objects.
 *
 * Run: SUPABASE_SERVICE_ROLE=... node fix-v67-attributes-new.js
 * Dry run: DRY_RUN=1 SUPABASE_SERVICE_ROLE=... node fix-v67-attributes-new.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '';
const DRY_RUN = process.env.DRY_RUN === '1';
const BATCH_SIZE = 100;

function kv2flat(attrs) {
  const obj = {};
  for (const a of attrs) {
    if (obj[a.k] === undefined) {
      obj[a.k] = a.v;
    } else if (Array.isArray(obj[a.k])) {
      obj[a.k].push(a.v);
    } else {
      obj[a.k] = [obj[a.k], a.v]; // promote to array on first duplicate
    }
  }
  return obj;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  // 1. Fetch JSON
  console.log('Fetching attributes JSON...');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/data/cryptophunksv67_attributes.json`);
  const attrMap = await res.json();
  const shas = Object.keys(attrMap);
  console.log(`JSON has ${shas.length} SHAs\n`);

  // 2. Get all ethscriptions for this slug to build sha→tokenId map (paginate to bypass 1000 limit)
  let ethRows = [], page = 0;
  while (true) {
    const { data, error: ethErr } = await supabase.from('ethscriptions').select('sha, tokenId').eq('slug', 'cryptophunksv67').range(page * 1000, (page + 1) * 1000 - 1);
    if (ethErr) { console.error('ethscriptions fetch error:', ethErr.message); return; }
    if (!data?.length) break;
    ethRows = ethRows.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  const shaToTokenId = new Map(ethRows.map(r => [r.sha, r.tokenId]));
  console.log(`ethscriptions: ${ethRows.length} rows\n`);

  // 3. Build sha→oldSha mapping from attributes_new (to catch swapped tokens)
  const { data: oldAttrRows } = await supabase
    .from('attributes_new')
    .select('sha, tokenId')
    .eq('slug', 'cryptophunksv67');
  const tokenIdToOldSha = new Map(oldAttrRows?.map(r => [r.tokenId, r.sha]) || []);

  // 4. Build updates: for each SHA in JSON, convert attrs and upsert attributes_new
  const updates = [];
  for (const sha of shas) {
    const attrs = attrMap[sha];
    if (!attrs || !Array.isArray(attrs)) continue;
    const values = kv2flat(attrs);
    const tokenId = shaToTokenId.get(sha);
    if (tokenId) {
      updates.push({ sha, slug: 'cryptophunksv67', tokenId, values });
    }
  }
  // Known remaps: tokens whose new SHA isn't in JSON but old SHA is
  // newSha here is the CORRECT sha to store (from v67 updates.json), oldSha is what's currently in ethscriptions (wrong)
  const KNOWN_REMAPS = [
    { tokenId: 1848, newSha: 'ae72e8cafe049e3d42415ed836eb65f9642a043ffdb66506e43bd6b56a1ab0a3', oldSha: '11c4ff0c96fa5d01b76acf7e6bd193c2d493fe6310ebdcf84670d60d9747ab0d' },
  ];
  for (const { tokenId, newSha, oldSha } of KNOWN_REMAPS) {
    if (attrMap[oldSha]) {
      const values = kv2flat(attrMap[oldSha]);
      updates.push({ sha: newSha, slug: 'cryptophunksv67', tokenId, values });
      console.log(`  Remapped #${tokenId}: old sha ${oldSha.slice(0,12)}... → new sha ${newSha.slice(0,12)}...`);
    }
  }

  console.log(`Prepared ${updates.length} upserts`);
  if (DRY_RUN) {
    const hasAnimated = (v) => Array.isArray(v) ? v.some(x => x?.toLowerCase().includes('animated')) : v?.toLowerCase().includes('animated');
    const animated = updates.filter(u => hasAnimated(u.values?.Special));
    console.log(`[DRY RUN] Would upsert ${updates.length} records. Animated count: ${animated.length}`);
    animated.forEach(u => console.log('  #'+u.tokenId, 'Special:', u.values.Special));
    return;
  }

  let done = 0, failed = 0;
  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    const { error } = await supabase
      .from('attributes_new')
      .update({ values: u.values, sha: u.sha })
      .eq('tokenId', u.tokenId)
      .eq('slug', u.slug);
    if (error) { console.error(`#${u.tokenId} error:`, error.message); failed++; }
    else {
      done++;
      if (done % 500 === 0 || done === updates.length) console.log(`  ✅ ${done}/${updates.length}`);
    }
  }

  console.log(`\nDone: ${done} upserted, ${failed} errors`);

  // Verify animated count
  const { data: check } = await supabase.from('attributes_new').select('tokenId').eq('slug','cryptophunksv67').ilike('values->Special', 'Animated');
  // Use containedBy or filter differently since values is jsonb
  const { data: animCheck } = await supabase.from('attributes_new').select('tokenId, values').eq('slug','cryptophunksv67').eq('values->>Special', 'Animated');
  console.log(`\nAnimated in attributes_new after fix: ${animCheck?.length}`);
  animCheck?.forEach(r => console.log('  #'+r.tokenId));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
