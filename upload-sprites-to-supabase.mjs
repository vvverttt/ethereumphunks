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

const env = fs.readFileSync('./indexer/.env', 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const URL_ = g('SUPABASE_URL');
const KEY = g('SUPABASE_SERVICE_ROLE');

if (!KEY) {
  console.error('ABORT: SUPABASE_SERVICE_ROLE missing from indexer/.env');
  console.error('');
  console.error('  The key was rotated, so the old value no longer works. Add the new one:');
  console.error('    Supabase dashboard -> Project Settings -> API Keys -> the sb_secret_ key');
  console.error('    indexer/.env:   SUPABASE_SERVICE_ROLE=<the key>');
  console.error('  indexer/.env is gitignored; the key is never committed.');
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

const put = async (name, body, type) => {
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`${URL_}/storage/v1/object/static/${name}`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': type, 'x-upsert': 'true' },
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

console.log('\nverify (both must be the real bytes, not an HTML fallback):');
console.log(`  curl -sI ${URL_}/storage/v1/object/public/static/sprite.json`);
console.log(`  curl -sI ${URL_}/storage/v1/object/public/static/sprite-0.png`);
