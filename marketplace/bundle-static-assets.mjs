// Copy the immutable half of the site — collection images and attribute JSON —
// into a built folder so the IPFS/.eth.limo deploy serves them from its own CID
// instead of reaching out to Supabase on every tile.
//
//   node bundle-static-assets.mjs <buildDir> [cacheDir]
//   node bundle-static-assets.mjs --config <name> [cacheDir]
//
// The --config form reads the dated output path prebuild.js just wrote into
// angular.json, the same way copy-to-fixed.js does, so the folder that gets
// pinned can carry a date without this step guessing at it.
//
// Layout produced (matches the URLs the app builds when staticUrl is ''):
//   <buildDir>/static/images/{sha}              — no extension, as Supabase serves it
//   <buildDir>/data/{slug}_attributes.json
//   <buildDir>/data/collections.json            — logo + preview pool per collection
//   <buildDir>/static/collections/{slug}-{hash}.{ext}   — the logos, named by content
//
// Safe to re-run: anything already present is skipped. A cacheDir of {sha}.png
// files (see fetch-collection-shas.mjs) avoids re-downloading; whatever is missing
// is pulled with backoff, since storage 429s well before it saturates.

import fs from 'fs';
import path from 'path';
import http2 from 'http2';
import { createHash } from 'crypto';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

// `--config <name>` resolves the build dir from angular.json instead of taking a
// literal path, so a dated output folder stays correct across a midnight boundary.
const CONFIG = process.argv[2] === '--config' ? process.argv[3] : null;
const BUILD = CONFIG
  ? path.join(
      HERE,
      JSON.parse(fs.readFileSync(path.join(HERE, 'angular.json'), 'utf8'))
        .projects['etherphunks-market'].architect.build.configurations[CONFIG].outputPath.base,
      'browser',
    )
  : process.argv[2];

// Persist fetched images between builds. `ng build` wipes the output dir every
// run, so without this each deploy would re-pull ~9.5k objects (~9 minutes, and
// storage starts 429ing). Gitignored; delete it to force a clean re-fetch.
const CACHE = (CONFIG ? process.argv[4] : process.argv[3]) || path.join(HERE, '.image-cache');
const HOST = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const PREFIX = '/storage/v1/object/public';
const KEY = 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe';
const CONC = 8;

if (!BUILD) { console.error('usage: node bundle-static-assets.mjs <buildDir> [cacheDir]'); process.exit(1); }
if (!fs.existsSync(path.join(BUILD, 'index.html'))) {
  console.error(`not a build dir (no index.html): ${BUILD}`); process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const imgDir = path.join(BUILD, 'static', 'images');
const dataDir = path.join(BUILD, 'data');
fs.mkdirSync(imgDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

const connect = () => new Promise((res, rej) => {
  const c = http2.connect(HOST, { settings: { enablePush: false } });
  c.on('connect', () => res(c)); c.on('error', rej);
});

const get = (client, p) => new Promise((resolve, reject) => {
  const req = client.request({ ':path': p });
  const chunks = []; let status = 0;
  req.on('response', h => { status = h[':status']; });
  req.on('data', d => chunks.push(d));
  req.on('end', () => resolve({ status, body: Buffer.concat(chunks) }));
  req.on('error', reject);
  req.setTimeout(30000, () => req.destroy(new Error('timeout')));
});

const post = (client, p, json) => new Promise((resolve, reject) => {
  const req = client.request({ ':method': 'POST', ':path': p, 'content-type': 'application/json' });
  const chunks = []; let status = 0;
  req.on('response', h => { status = h[':status']; });
  req.on('data', d => chunks.push(d));
  req.on('end', () => resolve({ status, body: Buffer.concat(chunks) }));
  req.on('error', reject);
  req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  req.end(JSON.stringify(json));
});

// The part of a collection that only changes when one is onboarded — its logo and a pool of
// preview items — so the app can stop asking Postgres for it on every page load (see
// DataService.fetchCollections, which merges this with the small live columns). The RPC it
// stands in for returned ~139 KB per visit, ~100 KB of it one logo stored as a data URI, and
// sorted every item of every collection by RANDOM() to pick the previews.
//
// Optional by design: on any failure it writes nothing and the app falls back to the RPC.
const PREVIEW_POOL = 40;
const LOGO_EXT = { 'image/png': 'png', 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

async function bundleCollections(client) {
  const r = await post(client, `/rest/v1/rpc/fetch_collections_with_previews?apikey=${KEY}`, { preview_limit: PREVIEW_POOL, show_inactive: false });
  if (r.status !== 200) throw new Error(`fetch_collections_with_previews: ${r.status}`);
  const rows = JSON.parse(r.body.toString('utf8')).map(x => x.ethscription || x);
  const logoDir = path.join(BUILD, 'static', 'collections');
  fs.mkdirSync(logoDir, { recursive: true });

  const collections = {};
  for (const c of rows) {
    let image = c.image || null;
    let bytes = null, mime = null;
    const dataUri = typeof image === 'string' && image.match(/^data:([^;,]+);base64,(.*)$/s);
    if (dataUri) { mime = dataUri[1]; bytes = Buffer.from(dataUri[2], 'base64'); }
    else if (typeof image === 'string' && image.startsWith(`${HOST}/`)) {
      // logo in our own Storage: bundle it too, so showing it costs no Supabase egress
      const lr = await get(client, image.slice(HOST.length)).catch(() => null);
      if (lr?.status === 200 && lr.body.length) { bytes = lr.body; mime = image.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/png'; }
    }
    if (bytes && LOGO_EXT[mime]) {
      const file = `${c.slug}-${createHash('sha256').update(bytes).digest('hex').slice(0, 10)}.${LOGO_EXT[mime]}`;
      fs.writeFileSync(path.join(logoDir, file), bytes);
      image = `/static/collections/${file}`;
    }
    collections[c.slug] = {
      image,
      previews: (c.previews || []).map(p => ({ hashId: p.hashId, tokenId: p.tokenId, slug: c.slug, sha: p.sha })),
    };
  }
  const out = { generated: new Date().toISOString(), collections };
  fs.writeFileSync(path.join(dataDir, 'collections.json'), JSON.stringify(out));
  const size = fs.statSync(path.join(dataDir, 'collections.json')).size;
  console.log(`collections snapshot: ${rows.length} collections, ${(size / 1024).toFixed(1)} KB, logos in static/collections/\n`);
}

async function main() {
  const c0 = await connect();

  // Collections drive which attribute files to bundle.
  const collRes = await get(c0, `/rest/v1/collections?select=slug&apikey=${KEY}`);
  if (collRes.status !== 200) throw new Error(`collections fetch failed: ${collRes.status}`);
  const slugs = JSON.parse(collRes.body.toString('utf8')).map(c => c.slug);
  console.log(`collections: ${slugs.length}`);

  // Attribute JSON per collection. Two collections were renamed but their Storage
  // objects were not, so they still live under the old `og-` filenames — the app
  // reaches for the same names via DataService.ATTRIBUTE_FILE_OVERRIDES. Bundling
  // them by plain slug fetched a 404 and shipped a build with no traits for either,
  // which is what "no attributes — traits omitted" was quietly reporting.
  // Keep this in step with that override map.
  const FILE_OVERRIDES = {
    'missing-phunks': 'og-missing-phunks',
    'dysto-phunks': 'og-dysto-phunks',
  };

  let attrBytes = 0;
  let attrMissing = 0;
  for (const slug of slugs) {
    const name = `${FILE_OVERRIDES[slug] ?? slug}_attributes.json`;
    const dest = path.join(dataDir, name);
    let body;
    if (fs.existsSync(dest)) { body = fs.readFileSync(dest); }
    else {
      const r = await get(c0, `${PREFIX}/data/${name}`);
      if (r.status !== 200) {
        attrMissing++;
        console.log(`  ${slug}: NO ATTRIBUTES (${r.status}) for ${name} — traits will be missing`);
        continue;
      }
      body = r.body; fs.writeFileSync(dest, body);
    }
    attrBytes += body.length;
    console.log(`  ${slug}: ${name} ${(body.length / 1048576).toFixed(2)} MB`);
  }
  console.log(`attributes total ${(attrBytes / 1048576).toFixed(2)} MB` + (attrMissing ? `, ${attrMissing} MISSING` : ''));
  if (attrMissing) {
    console.error(`\n${attrMissing} collection(s) have no attributes file — refusing to ship a build whose trait filters silently do nothing`);
    process.exit(1);
  }
  console.log('');

  try { await bundleCollections(c0); }
  catch (e) { console.log(`collections snapshot skipped (${e.message}) — the app will use the RPC\n`); }

  // Which images to bundle comes from the ethscriptions table, not from the attribute
  // files. Every call site in the app builds `staticUrl + /static/images/{sha}` from a
  // row's sha, so the table IS the set of images the site can ask for — phunks, the
  // ERC-721 collections and plain ethscriptions alike. Deriving it from attributes
  // instead silently dropped the 319 items in the two trait-less collections, and those
  // tiles then 404'd against a bundle that has no Supabase to fall back to.
  const shas = new Set();
  for (let offset = 0; ; offset += 1000) {
    const r = await get(c0, `/rest/v1/ethscriptions?select=sha&limit=1000&offset=${offset}&apikey=${KEY}`);
    if (r.status !== 200) throw new Error(`ethscriptions fetch failed at offset ${offset}: ${r.status}`);
    const rows = JSON.parse(r.body.toString('utf8'));
    for (const row of rows) if (row.sha) shas.add(row.sha);
    if (rows.length < 1000) break;
  }
  c0.close();
  if (!shas.size) throw new Error('ethscriptions returned no shas — refusing to ship an imageless bundle');
  console.log(`${shas.size} distinct shas to bundle\n`);

  // Images: copy from cache where possible, fetch the rest.
  const all = [...shas];
  const missing = [];
  let copied = 0;
  for (const sha of all) {
    const dest = path.join(imgDir, sha);
    if (fs.existsSync(dest)) continue;
    const src = CACHE ? path.join(CACHE, sha + '.png') : '';
    if (src && fs.existsSync(src)) { fs.copyFileSync(src, dest); copied++; }
    else missing.push(sha);
  }
  console.log(`images: ${copied} from cache, ${missing.length} to fetch`);

  if (missing.length) {
    const pool = await Promise.all([1, 2].map(connect));
    let next = 0, done = 0, failed = 0;
    const worker = async (client) => {
      for (;;) {
        const i = next++; if (i >= missing.length) return;
        const sha = missing[i];
        let ok = false;
        for (let a = 0; a < 6 && !ok; a++) {
          try {
            const r = await get(client, `${PREFIX}/static/images/${sha}`);
            if (r.status === 200 && r.body.length) {
              fs.writeFileSync(path.join(imgDir, sha), r.body);
              fs.writeFileSync(path.join(CACHE, sha + '.png'), r.body); // seed the cache for next build
              ok = true;
            }
            else await sleep(500 * 2 ** a + Math.random() * 300);
          } catch { await sleep(500 * 2 ** a + Math.random() * 300); }
        }
        if (!ok) { failed++; console.error(`  FAILED ${sha}`); }
        if (++done % 500 === 0) console.log(`  ${done}/${missing.length}`);
      }
    };
    await Promise.all(Array.from({ length: CONC }, (_, i) => worker(pool[i % pool.length])));
    pool.forEach(c => c.close());
    if (failed) { console.error(`\n${failed} images could not be fetched — aborting so a broken bundle is not shipped`); process.exit(1); }
  }

  const count = fs.readdirSync(imgDir).length;
  let bytes = 0; for (const f of fs.readdirSync(imgDir)) bytes += fs.statSync(path.join(imgDir, f)).size;
  const attrFiles = fs.readdirSync(dataDir).length;
  console.log(`\nbundled ${count} images (${(bytes / 1048576).toFixed(2)} MB) + ${attrFiles} attribute files`);
  if (count !== shas.size) console.log(`  ! expected ${shas.size} — folder holds ${count}`);
}

main().catch(e => { console.error(e); process.exit(1); });
