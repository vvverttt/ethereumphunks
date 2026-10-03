// Give the data-bucket attribute files a cache header.
//
// Supabase stores objects `cache-control: no-cache` unless told otherwise, so every visitor
// re-downloads them on every page load. cryptophunksv67_attributes.json is 3.0 MB — that is
// the single largest repeated download on the site, and it is both egress and a log line each
// time. phikings already has max-age=3600, so this only brings the rest in line.
//
// NOT immutable, unlike the images and sprite sheets: those are content-addressed (a new sha is
// a new URL), while these files are overwritten in place when a collection changes. An
// immutable header on a mutable URL would pin visitors to stale traits until they cleared their
// cache. One hour is the same value phikings uses and bounds the staleness.
//
// The frontend caches these in localStorage behind CACHE_VERSION anyway, so the HTTP layer is
// the second line of defence, not the only one.
//
//   node set-data-cache-headers.mjs           dry run
//   RUN=1 node set-data-cache-headers.mjs     apply
//
// Needs SUPABASE_SERVICE_ROLE in the environment (it is deliberately not kept on disk):
//   PowerShell:  $env:SUPABASE_SERVICE_ROLE="sb_secret_..."
import fs from 'fs';

const RUN = process.env.RUN === '1';
const CACHE = 'public, max-age=3600';

const env = fs.existsSync('./indexer/.env') ? fs.readFileSync('./indexer/.env', 'utf8') : '';
const g = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const URL_ = process.env.SUPABASE_URL || g('SUPABASE_URL') || 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE || g('SUPABASE_SERVICE_ROLE');

if (RUN && !KEY) {
  console.error('ABORT: writing needs SUPABASE_SERVICE_ROLE in the environment.');
  console.error('  PowerShell:  $env:SUPABASE_SERVICE_ROLE="sb_secret_..."');
  console.error('               $env:RUN="1"; node set-data-cache-headers.mjs');
  process.exit(1);
}

// List what is actually in the bucket rather than assuming the file names.
const list = await (await fetch(`${URL_}/storage/v1/object/list/data`, {
  method: 'POST',
  headers: KEY
    ? { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prefix: '', limit: 200, sortBy: { column: 'name', order: 'asc' } }),
})).json();

const files = Array.isArray(list) ? list.map((f) => f.name).filter((n) => n.endsWith('.json')) : [];
if (!files.length) {
  console.error('Could not list the bucket (needs the service key). Falling back to known names.');
}
const targets = files.length ? files : [
  'cryptophunksv67_attributes.json', 'ethsrocks_attributes.json', 'phikings_attributes.json',
  'og-missing-phunks_attributes.json', 'og-dysto-phunks_attributes.json',
  'quantumdystophunkzv67_attributes.json', 'quantummissingphunksv67_attributes.json',
];

console.log(`${targets.length} file(s) in the data bucket\n`);

let changed = 0;
for (const name of targets) {
  // GET, not HEAD. Supabase's storage HEAD does not return the real cache-control or
  // content-length here — it reported "no-cache" for a file that answers max-age=3600 on GET,
  // which would have made this script "fix" a file that was already correct.
  const head = await fetch(`${URL_}/storage/v1/object/public/data/${name}?cb=${Date.now()}`);
  const cc = head.headers.get('cache-control') || '(none)';
  // Measure the BODY, not content-length: responses come back chunked/compressed so the header
  // is absent, and comparing 0 to 0 afterwards would make the safety check below pass on any
  // outcome — including one that truncated the file.
  const before = Buffer.from(await head.arrayBuffer());
  const size = before.length;
  const needs = cc !== CACHE;
  console.log(`  ${name.padEnd(42)} ${(size / 1024).toFixed(0).padStart(5)} KB  ${cc}${needs ? '   -> set' : '   ok'}`);
  if (!needs || !RUN) { if (needs) changed++; continue; }

  // Re-upload the SAME bytes with the header attached. Read from the public URL so the file
  // cannot be altered in the process — this changes metadata only.
  const body = before;   // the exact bytes just read — no second fetch to drift against
  const put = await fetch(`${URL_}/storage/v1/object/data/${name}`, {
    method: 'POST',
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': CACHE,
    },
    body,
  });
  if (!put.ok) { console.log(`      FAILED ${put.status}: ${(await put.text()).slice(0, 120)}`); continue; }

  // Re-read with retries. A cache-buster defeats the BROWSER cache but not Cloudflare's edge,
  // which keeps serving its copy for a few seconds after the upload. Checking once reported
  // "no-cache" on files that had in fact been updated correctly — a verification step that
  // cries wolf is worse than none, because the next person distrusts the real failures too.
  let after, got, gotSize = 0;
  for (let a = 0; a < 6; a++) {
    after = await fetch(`${URL_}/storage/v1/object/public/data/${name}?cb=${Date.now()}${Math.random()}`);
    got = after.headers.get('cache-control');
    gotSize = (await after.arrayBuffer()).byteLength;
    if (got === CACHE) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  // Size must be unchanged — this is a metadata edit, and a size change means bytes were lost.
  console.log(`      now "${got}"  ${gotSize === size ? 'size unchanged' : `SIZE CHANGED ${size} -> ${gotSize}  INVESTIGATE`}`);
  changed++;
}

if (!RUN) {
  console.log(`\n${changed} file(s) would be updated. DRY RUN — re-run with RUN=1.`);
} else {
  console.log(`\ndone: ${changed} file(s) updated to "${CACHE}"`);
}
