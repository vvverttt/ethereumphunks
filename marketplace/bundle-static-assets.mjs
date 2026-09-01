// Copy the immutable half of the site — collection images and attribute JSON —
// into a built folder so the IPFS/.eth.limo deploy serves them from its own CID
// instead of reaching out to Supabase on every tile.
//
//   node bundle-static-assets.mjs <buildDir> [cacheDir]
//
// Layout produced (matches the URLs the app builds when staticUrl is ''):
//   <buildDir>/static/images/{sha}              — no extension, as Supabase serves it
//   <buildDir>/data/{slug}_attributes.json
//
// Safe to re-run: anything already present is skipped. A cacheDir of {sha}.png
// files (see fetch-collection-shas.mjs) avoids re-downloading; whatever is missing
// is pulled with backoff, since storage 429s well before it saturates.

import fs from 'fs';
import path from 'path';
import http2 from 'http2';

const BUILD = process.argv[2];
// Persist fetched images between builds. `ng build` wipes the output dir every
// run, so without this each deploy would re-pull ~9.5k objects (~9 minutes, and
// storage starts 429ing). Gitignored; delete it to force a clean re-fetch.
const CACHE = process.argv[3] || path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '.image-cache');
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

async function main() {
  const c0 = await connect();

  // Collections drive which attribute files to bundle.
  const collRes = await get(c0, `/rest/v1/collections?select=slug&apikey=${KEY}`);
  if (collRes.status !== 200) throw new Error(`collections fetch failed: ${collRes.status}`);
  const slugs = JSON.parse(collRes.body.toString('utf8')).map(c => c.slug);
  console.log(`collections: ${slugs.length}`);

  // Attribute JSON per collection, and the union of every sha they reference.
  const shas = new Set();
  let attrBytes = 0;
  for (const slug of slugs) {
    const dest = path.join(dataDir, `${slug}_attributes.json`);
    let body;
    if (fs.existsSync(dest)) { body = fs.readFileSync(dest); }
    else {
      const r = await get(c0, `${PREFIX}/data/${slug}_attributes.json`);
      if (r.status !== 200) { console.log(`  ${slug}: no attributes (${r.status}) — skipped`); continue; }
      body = r.body; fs.writeFileSync(dest, body);
    }
    attrBytes += body.length;
    try { Object.keys(JSON.parse(body.toString('utf8'))).forEach(s => shas.add(s)); }
    catch { console.log(`  ${slug}: attributes not a sha map — images resolved elsewhere`); }
    console.log(`  ${slug}: ${(body.length / 1048576).toFixed(2)} MB`);
  }
  c0.close();
  console.log(`attributes total ${(attrBytes / 1048576).toFixed(2)} MB, ${shas.size} distinct shas\n`);

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
  console.log(`\nbundled ${count} images (${(bytes / 1048576).toFixed(2)} MB) + ${slugs.length} attribute files`);
  if (count !== shas.size) console.log(`  ! expected ${shas.size} — folder holds ${count}`);
}

main().catch(e => { console.error(e); process.exit(1); });
