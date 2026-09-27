// Put the final 1,081 into every layer the site reads, so the grid shows all 10,000.
//
// Follows exactly what the 4,667 batch did (insert-v67-rows.mjs), plus the two storage
// layers that script left to a separate step. The layers drift apart if only some are
// written — that has bitten this collection three times — so all five happen here:
//
//   1. attributes_new              the traits the grid joins on (sha-keyed)
//   2. ethscriptions               the rows the grid lists      (hashId-keyed)
//   3. static/images/{sha}         the art                      (sha-keyed, no extension)
//   4. data/cryptophunksv67_attributes.json   what the attributes page reads (sha-keyed)
//   5. collections.supply          the displayed total
//
// Idempotent: re-running upserts the same values and re-uploads the same bytes.
//
//   node push-v67-1081-supabase.mjs           dry run, changes nothing
//   RUN=1 node push-v67-1081-supabase.mjs     write
import fs from 'fs';

const RUN = process.env.RUN === '1';
const SLUG = 'cryptophunksv67';
const OUT = './v67_new1066';
const CHUNK = Number(process.env.CHUNK || 200);

// The secret is NOT kept in indexer/.env (removed 2026-09-26 so no copy sits on disk). Pass it
// for this one command and it lives only in that shell's memory.
const env = fs.existsSync('./indexer/.env') ? fs.readFileSync('./indexer/.env', 'utf8') : '';
const g = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const URL_ = process.env.SUPABASE_URL || g('SUPABASE_URL');
const KEY = process.env.SUPABASE_SERVICE_ROLE || g('SUPABASE_SERVICE_ROLE');

if (!URL_) { console.error('ABORT: SUPABASE_URL missing (indexer/.env or the environment)'); process.exit(1); }
if (!KEY) {
  console.error('ABORT: no SUPABASE_SERVICE_ROLE in the environment.');
  console.error('');
  console.error('  It is intentionally not stored on disk. Set it for this shell only:');
  console.error('    PowerShell:  $env:SUPABASE_SERVICE_ROLE="sb_secret_..."');
  console.error('    bash:        export SUPABASE_SERVICE_ROLE=sb_secret_...');
  console.error('');
  console.error('  Get it from: Supabase dashboard -> Project Settings -> API Keys');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const rows = JSON.parse(fs.readFileSync(`${OUT}/v67-1081-attributes-new.json`, 'utf8'));
const owners = JSON.parse(fs.readFileSync(`${OUT}/v67-1081-owners.json`, 'utf8'));
const images = JSON.parse(fs.readFileSync(`${OUT}/v67-1081-images.json`, 'utf8'));
const surrogate = async (id) => {
  const { createHash } = await import('crypto');
  return '0x' + createHash('sha256').update(`${SLUG}:${id}`).digest('hex');
};

console.log(`${rows.length} tokens\n`);

// Never write over a token that is already there.
const live = new Set();
for (let f = 0; ; f += 1000) {
  const r = await fetch(`${URL_}/rest/v1/ethscriptions?slug=eq.${SLUG}&select=tokenId`, { headers: { ...H, Range: `${f}-${f + 999}` } });
  const page = await r.json();
  for (const x of page) live.add(x.tokenId);
  if (page.length < 1000) break;
}
const clash = rows.filter((r) => live.has(r.tokenId));
console.log(`  already in db for this slug: ${live.size}`);
console.log(`  collisions with our set:     ${clash.length}`);
if (clash.length) { console.error(`ABORT: ${clash.slice(0, 10).map((c) => c.tokenId).join(', ')} already exist`); process.exit(1); }

if (!RUN) {
  console.log(`\n  would write:`);
  console.log(`    attributes_new   ${rows.length} rows`);
  console.log(`    ethscriptions    ${rows.length} rows`);
  console.log(`    static/images    ${Object.keys(images).length} objects`);
  console.log(`    data/${SLUG}_attributes.json   merged`);
  console.log(`    collections.supply -> ${live.size + rows.length}`);
  console.log(`\nDRY RUN — re-run with RUN=1`);
  process.exit(0);
}

const post = async (table, payload, conflict) => {
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    let ok = false;
    for (let a = 0; a < 4 && !ok; a++) {
      const r = await fetch(`${URL_}/rest/v1/${table}${conflict ? `?on_conflict=${conflict}` : ''}`, {
        method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(slice),
      });
      if (r.ok) ok = true;
      else if (a === 3) { console.error(`\n  ${table} ${r.status}: ${(await r.text()).slice(0, 220)}`); return false; }
      else await new Promise((x) => setTimeout(x, 600 * (a + 1)));
    }
    process.stdout.write(`\r  ${table}: ${Math.min(i + CHUNK, payload.length)}/${payload.length}   `);
  }
  console.log('');
  return true;
};

// 1. attributes_new — the grid joins on this; a missing row means the token silently vanishes
if (!await post('attributes_new', rows.map((r) => ({ sha: r.sha, values: r.values, slug: SLUG, tokenId: r.tokenId })), 'sha')) process.exit(1);

// 2. ethscriptions
const eth = [];
for (const r of rows) {
  const o = (owners[r.tokenId] || '').toLowerCase();
  if (!o) { console.error(`ABORT: #${r.tokenId} has no owner`); process.exit(1); }
  eth.push({ hashId: await surrogate(r.tokenId), sha: r.sha, slug: SLUG, tokenId: r.tokenId,
             owner: o, prevOwner: o, creator: o, locked: false });
}
if (!await post('ethscriptions', eth, 'hashId')) process.exit(1);

// 3. static/images/{sha} — raw png bytes, no extension, exactly as the older ones are stored
let up = 0, skip = 0;
const entries = Object.entries(images);
for (let i = 0; i < entries.length; i++) {
  const [sha, dataUri] = entries[i];
  const bytes = Buffer.from(dataUri.split(',')[1], 'base64');
  const r = await fetch(`${URL_}/storage/v1/object/static/images/${sha}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'image/png', 'x-upsert': 'true' },
    body: bytes,
  });
  if (r.ok) up++; else { skip++; if (skip < 4) console.error(`\n  image ${sha.slice(0, 12)} ${r.status}: ${(await r.text()).slice(0, 120)}`); }
  if (i % 25 === 0) process.stdout.write(`\r  images: ${i + 1}/${entries.length}  (${up} ok, ${skip} failed)   `);
}
console.log(`\r  images: ${up} uploaded, ${skip} failed                    `);

// 4. data bucket JSON — sha-keyed [{k,v}], what the attributes page reads.
//    Merge into the LIVE copy, never a repo copy: the repo one is stale and merging from
//    it silently drops One-of-One badges.
const cur = await (await fetch(`${URL_}/storage/v1/object/public/data/${SLUG}_attributes.json`)).json();
const before = Object.keys(cur).length;
for (const r of rows) {
  cur[r.sha] = Object.entries(r.values).flatMap(([k, v]) => Array.isArray(v) ? v.map((x) => ({ k, v: x })) : [{ k, v }]);
}
const after = Object.keys(cur).length;
const putJson = await fetch(`${URL_}/storage/v1/object/data/${SLUG}_attributes.json`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'x-upsert': 'true' },
  body: JSON.stringify(cur),
});
console.log(`  data bucket JSON: ${before} -> ${after} shas   ${putJson.ok ? 'uploaded' : 'FAILED ' + putJson.status}`);

// 5. supply
const cnt = await fetch(`${URL_}/rest/v1/ethscriptions?slug=eq.${SLUG}&select=tokenId`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
const total = Number((cnt.headers.get('content-range') || '/0').split('/')[1]);
await fetch(`${URL_}/rest/v1/collections?slug=eq.${SLUG}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ supply: total }) });
console.log(`  collections.supply -> ${total}`);

console.log(`\ndone. verify with:  node verify-v67-10k.mjs`);
