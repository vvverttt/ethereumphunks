/*
 * Copy the attribute JSON files to their new slug names after the og- slug rename.
 *
 *   data/og-missing-phunks_attributes.json  ->  data/missing-phunks_attributes.json
 *   data/og-dysto-phunks_attributes.json    ->  data/dysto-phunks_attributes.json
 *
 * The app fetches `data/{slug}_attributes.json`, so once the slugs change in the
 * database it looks for the new filenames. Without this both collections load
 * with no traits at all.
 *
 * Uses the Storage REST API directly rather than @supabase/supabase-js: the
 * project has migrated to the new `sb_secret_` key format, and the installed SDK
 * still tries to parse the key as a JWT ("Invalid Compact JWS"). Passing it as a
 * plain bearer token works fine.
 *
 * COPIES, does not move — the originals stay so the rename can be rolled back.
 * Delete them by hand once the site is confirmed working.
 *
 * Run:  cd indexer && node rename-og-slug-assets.js
 * (a terminal, NOT the Supabase SQL editor — this is a shell command)
 */
const fs = require('fs');
const path = require('path');

const BUCKET = 'data';
const RENAMES = [
  ['og-missing-phunks_attributes.json', 'missing-phunks_attributes.json'],
  ['og-dysto-phunks_attributes.json', 'dysto-phunks_attributes.json'],
];

// Split on the first '=' and trim, rather than a regex with a lazy capture —
// that approach silently dropped the leading character of the value, which
// turned a valid sb_secret_ key into a malformed one and made Storage reject it
// as "Invalid Compact JWS". Easy to mistake for a key-format problem.
function fromEnvFile(name) {
  const p = path.join(__dirname, '.env');
  if (!fs.existsSync(p)) return '';
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    if (line.slice(0, eq).trim() !== name) continue;
    return line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return '';
}

const URL_BASE = (process.env.SUPABASE_URL || fromEnvFile('SUPABASE_URL') || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE || fromEnvFile('SUPABASE_SERVICE_ROLE');

if (!URL_BASE || !KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE not found (env or indexer/.env)');
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

(async () => {
  let failed = 0;

  for (const [from, to] of RENAMES) {
    // Read the source through the public path (these objects are public anyway).
    const src = await fetch(`${URL_BASE}/storage/v1/object/public/${BUCKET}/${from}`);
    if (!src.ok) {
      console.error(`  FAIL  read ${from}: HTTP ${src.status}`);
      failed++;
      continue;
    }
    const body = Buffer.from(await src.arrayBuffer());

    // upsert so a re-run is harmless.
    const put = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${to}`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json', 'x-upsert': 'true' },
      body,
    });
    if (!put.ok) {
      console.error(`  FAIL  write ${to}: HTTP ${put.status} ${(await put.text()).slice(0, 160)}`);
      failed++;
      continue;
    }

    // Read back rather than trusting the write — a silent mismatch here means
    // the collection renders with wrong or missing traits.
    const check = await fetch(`${URL_BASE}/storage/v1/object/public/${BUCKET}/${to}`);
    const back = check.ok ? Buffer.from(await check.arrayBuffer()) : null;
    const ok = back && back.length === body.length;
    console.log(`  ${ok ? 'OK  ' : 'MISMATCH'}  ${from} -> ${to}  (${body.length} bytes${ok ? '' : `, read back ${back ? back.length : 'nothing'}`})`);
    if (!ok) failed++;
  }

  console.log(failed
    ? `\n${failed} problem(s) — do NOT delete the originals`
    : '\nAll copied. Originals left in place; delete them once the site checks out.');
  process.exit(failed ? 1 : 0);
})();
