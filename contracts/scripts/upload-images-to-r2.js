/*
 * Mirror the site's collection images from Supabase storage -> Cloudflare R2, with immutable
 * caching, so they serve from Cloudflare's edge instead of Supabase's throttled single host.
 * Fixes the "some tiles never load" issue at the source (pair with the grid retry in phunk-grid).
 *
 * Copies EXACTLY what the site serves today: for every `sha` in the ethscriptions table it fetches
 *   {SUPABASE}/storage/v1/object/public/static/images/{sha}
 * and PUTs it to R2 key `static/images/{sha}` with `Cache-Control: public, max-age=31536000, immutable`
 * (safe — images are content-addressed by sha, so they never change).
 *
 * Setup (one time):
 *   cd contracts && npm i @aws-sdk/client-s3
 *   Create an R2 bucket + an S3 API token (Account > R2 > Manage API Tokens).
 *   Give the bucket a public custom domain (e.g. img.quantumphunks.com).
 *
 * Run:
 *   R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx R2_BUCKET=phunk-images \
 *   [SLUG=cryptophunksv67] [FORCE=1] \
 *   node scripts/upload-images-to-r2.js
 *
 * After it finishes, point the frontend at R2:
 *   environment.mainnet.ts  ->  imageCdnUrl: 'https://img.quantumphunks.com'
 *   NOT '.../storage/v1/object/public' — that prefix is a Supabase URL shape. Objects here are
 *   keyed `static/images/{sha}` at the bucket root, and the pipe appends `/static/images/{sha}`,
 *   so any extra prefix produces a 404 on every tile.
 */
const fs = require('fs');
const path = require('path');

const SUPABASE = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const KEY = 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe';
const STATIC = `${SUPABASE}/storage/v1/object/public/static/images/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Credentials come from contracts/.env.r2 (gitignored) so they never have to be
// pasted into a shell history or a chat. Real env vars still win if both are set.
const envFile = path.join(__dirname, '..', '.env.r2');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
const SLUG = process.env.SLUG || '';          // optional: limit to one collection
const FORCE = process.env.FORCE === '1';      // re-upload even if the object already exists
const CONC = Number(process.env.CONC || 12);
const CACHE_DIR = process.env.CACHE_DIR || ''; // optional: read bytes from {CACHE_DIR}/{sha}.png

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error('Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET');
  process.exit(1);
}

let S3, PutObjectCommand, HeadObjectCommand;
try { ({ S3Client: S3, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3')); }
catch { console.error('Missing dep. Run:  cd contracts && npm i @aws-sdk/client-s3'); process.exit(1); }

const s3 = new S3({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function allShas() {
  const out = new Map(); // sha -> true (dedupe; a sha can repeat across rows)
  let from = 0; const step = 1000;
  const slugFilter = SLUG ? `&slug=eq.${SLUG}` : '';
  for (;;) {
    const r = await fetch(`${SUPABASE}/rest/v1/ethscriptions?select=sha${slugFilter}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + step - 1}` } });
    const b = await r.json();
    if (!Array.isArray(b) || !b.length) break;
    for (const x of b) if (x.sha) out.set(x.sha, true);
    if (b.length < step) break; from += step;
  }
  return [...out.keys()];
}

async function exists(key) {
  if (FORCE) return false;
  try { await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })); return true; } catch { return false; }
}

async function mirror(sha) {
  const key = `static/images/${sha}`;
  if (await exists(key)) return 'skip';

  // Prefer a local copy when one was already pulled down — avoids re-fetching
  // thousands of objects through a source that rate-limits.
  if (CACHE_DIR) {
    const f = path.join(CACHE_DIR, sha + '.png');
    if (fs.existsSync(f)) {
      try {
        await s3.send(new PutObjectCommand({
          Bucket: R2_BUCKET, Key: key, Body: fs.readFileSync(f), ContentType: 'image/png',
          CacheControl: 'public, max-age=31536000, immutable',
        }));
        return 'put';
      } catch { /* fall through to the network path */ }
    }
  }

  for (let a = 0; a < 6; a++) {
    try {
      const r = await fetch(STATIC + sha);
      // Storage returns 429 long before it saturates; back off exponentially.
      if (!r.ok) {
        if (a === 5) return `src-${r.status}`;
        await sleep((r.status === 429 || r.status >= 500 ? 500 * 2 ** a : 400) + Math.random() * 300);
        continue;
      }
      const body = Buffer.from(await r.arrayBuffer());
      const ct = r.headers.get('content-type') || 'image/png';
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET, Key: key, Body: body, ContentType: ct,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      return 'put';
    } catch (e) { if (a === 5) return 'err'; await sleep(500 * (a + 1)); }
  }
  return 'err';
}

(async () => {
  const shas = await allShas();
  console.log(`shas to mirror${SLUG ? ` (slug=${SLUG})` : ''}: ${shas.length} -> bucket ${R2_BUCKET}`);
  const tally = { put: 0, skip: 0, err: 0, badsrc: 0 };
  const bad = [];
  for (let i = 0; i < shas.length; i += CONC) {
    const res = await Promise.all(shas.slice(i, i + CONC).map(mirror));
    res.forEach((r, j) => {
      if (r === 'put') tally.put++;
      else if (r === 'skip') tally.skip++;
      else if (r.startsWith('src-')) { tally.badsrc++; bad.push(shas[i + j] + ':' + r); }
      else { tally.err++; bad.push(shas[i + j] + ':' + r); }
    });
    process.stdout.write(`\r  ${Math.min(i + CONC, shas.length)}/${shas.length}  put=${tally.put} skip=${tally.skip} err=${tally.err} badsrc=${tally.badsrc}   `);
  }
  console.log(`\nDONE. put=${tally.put} skip=${tally.skip} err=${tally.err} missingAtSource=${tally.badsrc}`);
  if (bad.length) console.log('problems:', bad.slice(0, 30).join(', '));
  console.log('\nNext: set environment imageCdnUrl to your R2 public domain and redeploy the frontend.');
})();
