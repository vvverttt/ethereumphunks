// Put the sprite sheets in Supabase's `static` bucket, so the quota fix stops depending on
// Cloudflare's build command.
//
// The saving was never about WHO serves the images — it is that a grid page pulls ~21 sheets
// instead of ~250 individual tiles. Hosting the sheets next to the images on Supabase keeps
// that saving and removes the build-step dependency that broke the site: Cloudflare rebuilds
// from git without running build-sprite.mjs, so a same-origin `staticUrl` shipped an app whose
// assets were not there.
//
// Paths line up exactly with what SpriteService asks for:
//   `${staticUrl}/static/sprite.json`      -> bucket `static`, object `sprite.json`
//   `${staticUrl}/static/sprite-<n>.png`   -> bucket `static`, object `sprite-<n>.png`
// with staticUrl = https://<ref>.supabase.co/storage/v1/object/public
//
// The index and the sheets are ONE UNIT. A sprite.json read against a different generation's
// sheets maps every sha to the wrong tile, which renders as art from the wrong collection. So
// this uploads the index LAST: until it lands, tile() returns null for everything and each
// tile loads its own file — the safe direction to fail.
//
//   node upload-sprites-to-supabase.mjs           dry run
//   RUN=1 node upload-sprites-to-supabase.mjs     upload
import fs from 'fs';
import path from 'path';

const RUN = process.env.RUN === '1';
const BUILD = process.env.BUILD || './marketplace/dist/etherphunks-market-mainnet/browser/static';

// The secret is deliberately NOT kept in indexer/.env — it was removed 2026-09-26 so no copy
// of it sits on disk. Pass it for the one command that needs it and it lives only in that
// shell's memory:
//
//   PowerShell:  $env:SUPABASE_SERVICE_ROLE="sb_secret_..."
//   bash:        export SUPABASE_SERVICE_ROLE=sb_secret_...
//
// indexer/.env is still read for SUPABASE_URL, which is not a secret, and as a fallback for
// the key in case someone has it configured there.
const env = fs.existsSync('./indexer/.env') ? fs.readFileSync('./indexer/.env', 'utf8') : '';
const g = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const URL_ = process.env.SUPABASE_URL || g('SUPABASE_URL');
const KEY = process.env.SUPABASE_SERVICE_ROLE || g('SUPABASE_SERVICE_ROLE');

if (!KEY) {
  console.error('ABORT: no SUPABASE_SERVICE_ROLE in the environment.');
  console.error('');
  console.error('  It is intentionally not stored on disk. Set it for this shell only:');
  console.error('');
  console.error('    PowerShell:  $env:SUPABASE_SERVICE_ROLE="sb_secret_..."');
  console.error('                 $env:RUN="1"; node upload-sprites-to-supabase.mjs');
  console.error('');
  console.error('    bash:        SUPABASE_SERVICE_ROLE=sb_secret_... RUN=1 node upload-sprites-to-supabase.mjs');
  console.error('');
  console.error('  Get it from: Supabase dashboard -> Project Settings -> API Keys');
  process.exit(1);
}

const idxPath = path.join(BUILD, 'sprite.json');
if (!fs.existsSync(idxPath)) {
  console.error(`ABORT: ${idxPath} not found — run \`yarn build:mainnet\` in marketplace/ first.`);
  process.exit(1);
}

const sheets = fs.readdirSync(BUILD).filter((f) => /^sprite-\d+\.png$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));

// The index names how many sheets it expects; uploading a partial set would leave tiles
// pointing at sheets that do not exist.
const expected = Math.ceil(idx.count / idx.chunk);
console.log(`sprite.json   ${idx.count} tiles, chunk ${idx.chunk} -> expects ${expected} sheets`);
console.log(`on disk       ${sheets.length} sheets`);
if (sheets.length !== expected) {
  console.error(`ABORT: sheet count mismatch — the index and the sheets are one unit.`);
  process.exit(1);
}

const total = sheets.reduce((s, f) => s + fs.statSync(path.join(BUILD, f)).size, 0);
console.log(`              ${(total / 1048576).toFixed(2)} MB total, ${(fs.statSync(idxPath).size / 1024).toFixed(0)} KB index\n`);

if (!RUN) {
  console.log('  would upload to bucket `static`:');
  for (const f of sheets.slice(0, 3)) console.log(`    ${f}`);
  console.log(`    … ${sheets.length - 3} more`);
  console.log(`    sprite.json   (LAST — see the note at the top)`);
  console.log('\nDRY RUN — re-run with RUN=1');
  process.exit(0);
}

// Supabase stores objects with `cache-control: no-cache` unless told otherwise. Without this
// every visitor re-downloads all 21 sheets (5.75 MB) on every page load — which would trade the
// request-count problem for a worse bandwidth one. The sheets are safe to mark immutable
// because SpriteService requests them as `sprite-N.png?v=<app version>`, so a new build changes
// the URL and cannot read a previous generation's sheet out of cache.
//
// Matches what set-image-cache-headers.mjs already applied to the images themselves.
const CACHE = 'public, max-age=31536000, immutable';

const put = async (name, body, type) => {
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`${URL_}/storage/v1/object/static/${name}`, {
      method: 'POST',
      headers: {
        apikey: KEY, Authorization: `Bearer ${KEY}`,
        'Content-Type': type, 'x-upsert': 'true', 'cache-control': CACHE,
      },
      body,
    });
    if (r.ok) return true;
    if (a === 3) { console.error(`\n  ${name} ${r.status}: ${(await r.text()).slice(0, 160)}`); return false; }
    await new Promise((x) => setTimeout(x, 700 * (a + 1)));
  }
};

let ok = 0;
for (let i = 0; i < sheets.length; i++) {
  if (await put(sheets[i], fs.readFileSync(path.join(BUILD, sheets[i])), 'image/png')) ok++;
  process.stdout.write(`\r  sheets: ${i + 1}/${sheets.length} (${ok} ok)   `);
}
console.log('');

if (ok !== sheets.length) {
  console.error(`ABORT: only ${ok}/${sheets.length} sheets uploaded — NOT publishing the index.`);
  console.error('Tiles keep loading as individual files, which is correct but slow. Re-run.');
  process.exit(1);
}

// Index last, only once every sheet it references is in place.
const idxOk = await put('sprite.json', fs.readFileSync(idxPath), 'application/json');
console.log(`  sprite.json: ${idxOk ? 'uploaded' : 'FAILED'}`);

// Confirm the cache header actually stuck — an uncached sheet is worse than no sheet.
//
// The cache-buster is essential and its absence gave a false failure the first time this ran:
// Supabase fronts storage with a CDN, so a probe right after upload is answered from the
// pre-upload copy (cf:HIT) and reports the OLD header. The upload had worked; the check was
// reading stale bytes. Same trap as the bucket JSON in verify-v67-10k.mjs.
const probe = await fetch(`${URL_}/storage/v1/object/public/static/sprite-0.png?cb=${Date.now()}`, { method: 'HEAD' });
const cc = probe.headers.get('cache-control');
console.log(`\n  sprite-0.png  HTTP ${probe.status}  cf:${probe.headers.get('cf-cache-status')}  cache-control: ${cc}`);
if (cc !== CACHE) console.log(`  WARNING: expected "${CACHE}" — visitors will re-download the sheets.`);

console.log('\nverify (both must be the real bytes, not an HTML fallback):');
console.log(`  curl -sI ${URL_}/storage/v1/object/public/static/sprite.json`);
console.log(`  curl -sI ${URL_}/storage/v1/object/public/static/sprite-0.png`);
