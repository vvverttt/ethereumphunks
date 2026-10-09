/**
 * Onboards the "Phunklloween" Ethscription collection (7 items, #10387–10396)
 * into Supabase: collection row, attributes_new, storage images, attributes JSON.
 *
 * Mirrors import-phikings.js, with one deliberate difference: the images are pulled
 * from CHAIN at run time rather than read from a local folder, and each one's sha is
 * recomputed and checked against the manifest before it is uploaded. The sha is the
 * primary key for this collection everywhere — attributes_new.sha, the storage object
 * name, and the key in {slug}_attributes.json — so a single wrong byte would silently
 * orphan an item's art from its traits. Deriving the bytes from the same source the
 * sha is defined by removes that whole class of mistake, and removes the dependency on
 * a local directory that may not exist on the next machine.
 *
 * Run from the indexer/ folder (needs @supabase/supabase-js):
 *   SUPABASE_SERVICE_ROLE=<service_role_key> node import-phunklloween.js
 *
 * Dry run (fetches + verifies everything, writes nothing):
 *   SUPABASE_SERVICE_ROLE=<key> DRY=1 node import-phunklloween.js
 *
 * The service-role key is read from the environment and never stored in this file.
 * Afterwards run reindex-phunklloween.js to tag the on-chain ethscriptions.
 */
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const DRY = process.env.DRY === '1';
const MANIFEST = path.join(__dirname, '_phunklloween.json');
const STATIC_BASE = `${SUPABASE_URL}/storage/v1/object/public/static/images/`;

// Keyless public RPCs, tried in order. getTransaction is a cheap, widely-served call.
const RPCS = [
  'https://eth.drpc.org',
  'https://ethereum-rpc.publicnode.com',
  'https://rpc.mevblocker.io',
  'https://1rpc.io/eth',
];

if (!SUPABASE_SERVICE_ROLE) {
  console.error('❌ Set SUPABASE_SERVICE_ROLE in the environment before running.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let rr = 0;
async function getTxInput(hash) {
  let lastErr;
  for (let attempt = 0; attempt < RPCS.length * 2; attempt++) {
    const rpc = RPCS[rr++ % RPCS.length];
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionByHash', params: [hash] }),
        signal: AbortSignal.timeout(20000),
      });
      const d = await res.json();
      if (d?.result?.input) return d.result.input;
      lastErr = new Error(d?.error?.message || 'no input in response');
    } catch (e) {
      lastErr = e;
    }
    await sleep(400);
  }
  throw new Error(`could not fetch ${hash}: ${lastErr?.message}`);
}

async function main() {
  console.log(`🎃 Phunklloween import${DRY ? '  (DRY RUN — nothing will be written)' : ''}\n`);
  const started = Date.now();

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const { slug, name, singleName, description } = manifest;
  const items = manifest.collection_items;
  console.log(`✅ Loaded ${items.length} items from ${path.basename(MANIFEST)}`);

  // Every item must carry a real 64-hex sha and a 0x-prefixed tx hash before anything runs.
  const badSha = items.filter((i) => !/^[0-9a-f]{64}$/.test(i.sha || ''));
  const badId = items.filter((i) => !/^0x[0-9a-fA-F]{64}$/.test(i.id || ''));
  if (badSha.length || badId.length) {
    console.error(`❌ ${badSha.length} bad sha, ${badId.length} bad hashId. Aborting.`);
    process.exit(1);
  }

  // ---- Step 0: fetch from chain and VERIFY, before a single write ----------------
  // Done up front on purpose: a half-imported collection (rows written, images missing)
  // renders as a grid of broken tiles, so it is better to fail having written nothing.
  console.log('\n⛓️  Step 0: Fetching images from chain and verifying shas...');
  const png = new Map();
  for (const item of items) {
    const input = await getTxInput(item.id);
    const uri = Buffer.from(input.slice(2), 'hex').toString('utf8');
    const sha = crypto.createHash('sha256').update(uri).digest('hex');
    if (sha !== item.sha) {
      console.error(`❌ ${item.index} ${item.name}: sha mismatch\n   manifest ${item.sha}\n   on-chain ${sha}`);
      process.exit(1);
    }
    const b64 = uri.split('base64,')[1];
    if (!b64) { console.error(`❌ ${item.index}: content_uri is not base64`); process.exit(1); }
    const bytes = Buffer.from(b64, 'base64');
    if (bytes.subarray(1, 4).toString('ascii') !== 'PNG') {
      console.error(`❌ ${item.index}: decoded bytes are not a PNG`); process.exit(1);
    }
    png.set(item.index, bytes);
    console.log(`   ✅ ${item.index} ${item.name.padEnd(17)} ${String(bytes.length).padStart(5)} bytes  sha ok`);
  }
  console.log(`✅ All ${items.length} verified against chain`);

  const logoItem = items.find((i) => i.index === manifest.logo_index) || items[0];
  const logoUrl = STATIC_BASE + logoItem.sha;

  if (DRY) {
    console.log(`\n🔎 DRY RUN complete — everything verified, nothing written.`);
    console.log(`   collection : ${name} (${slug}), supply ${items.length}`);
    console.log(`   logo       : ${logoItem.name} -> ${logoUrl}`);
    return;
  }

  // ---- Step 1: collection row ----------------------------------------------------
  console.log('\n📦 Step 1: Upserting collection row...');
  const { error: colError } = await supabase.from('collections').upsert([{
    slug,
    name,
    singleName,
    description,
    supply: items.length,
    active: true,
    isMinting: false,
    mintEnabled: false,
    hasBackgrounds: false,
    notifications: false,
    image: logoUrl,
  }], { onConflict: 'slug' });
  if (colError) { console.error('❌ collection:', colError); return; }
  console.log(`✅ Collection row upserted (logo: ${logoItem.name})`);

  // ---- Step 2: attributes_new ({trait_type,value}[] -> {Key: Value}) --------------
  // This table is what the indexer consults to decide a sha belongs to a curated
  // collection, so it must land BEFORE the reindex script runs.
  console.log('\n📦 Step 2: Upserting attributes_new rows...');
  const attrRows = items.map((item) => {
    const values = {};
    item.attributes.forEach((a) => { values[a.trait_type] = a.value; });
    return { sha: item.sha, values, slug, tokenId: item.index };
  });
  const { error: attrError } = await supabase
    .from('attributes_new')
    .upsert(attrRows, { onConflict: 'sha' });
  if (attrError) { console.error('❌ attributes_new:', attrError); return; }
  console.log(`✅ ${attrRows.length} attributes upserted`);

  // ---- Step 3: images -> static/images/{sha} --------------------------------------
  console.log('\n🖼️  Step 3: Uploading images...');
  let up = 0, err = 0;
  for (const item of items) {
    const { error } = await supabase.storage
      .from('static')
      .upload(`images/${item.sha}`, png.get(item.index), { contentType: 'image/png', upsert: true });
    if (error) { console.error(`   ❌ ${item.index}: ${error.message}`); err++; }
    else { up++; console.log(`   ✅ ${item.index} ${item.name}`); }
  }
  console.log(`✅ Images: ${up} uploaded, ${err} errors`);
  if (err) { console.error('❌ Not all images uploaded — fix before reindexing.'); return; }

  // ---- Step 4: {slug}_attributes.json -> data bucket -------------------------------
  console.log(`\n📄 Step 4: Uploading ${slug}_attributes.json...`);
  const attributesJson = {};
  items.forEach((item) => {
    attributesJson[item.sha] = item.attributes.map((a) => ({ k: a.trait_type, v: a.value }));
  });
  const { error: jsonError } = await supabase.storage
    .from('data')
    .upload(`${slug}_attributes.json`, Buffer.from(JSON.stringify(attributesJson), 'utf8'), {
      // 1 hour, matching the other files in this bucket. Supabase otherwise defaults
      // objects to no-cache, which makes every visitor re-download it.
      contentType: 'application/json', upsert: true, cacheControl: '3600',
    });
  if (jsonError) { console.error('❌ attributes json:', jsonError); return; }
  console.log(`✅ ${slug}_attributes.json uploaded`);

  console.log(`\n🎉 Done in ${Math.round((Date.now() - started) / 1000)}s.`);
  console.log('   Next: node reindex-phunklloween.js  (tags the on-chain ethscriptions)');
}

main().catch((e) => { console.error('💥', e); process.exit(1); });
