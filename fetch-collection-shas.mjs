// Download every image for a collection into a local cache dir, over a small
// pool of HTTP/2 connections. Re-runs are cheap: anything already on disk is skipped.
//
//   node fetch-collection-shas.mjs <slug> <cacheDir> [concurrency]
//
// Source of truth for the sha list is the public attributes JSON, which is what
// the site itself reads, so the cache ends up matching exactly what users see.

import fs from 'fs';
import path from 'path';
import http2 from 'http2';

const SLUG = process.argv[2] || 'cryptophunksv67';
const CACHE = process.argv[3];
const CONC = Number(process.argv[4] || 24);
const HOST = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const PREFIX = '/storage/v1/object/public';

if (!CACHE) { console.error('usage: node fetch-collection-shas.mjs <slug> <cacheDir> [conc]'); process.exit(1); }
fs.mkdirSync(CACHE, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

const get = (client, p) => new Promise((resolve, reject) => {
  const req = client.request({ ':path': p });
  const chunks = [];
  let status = 0;
  req.on('response', h => { status = h[':status']; });
  req.on('data', d => chunks.push(d));
  req.on('end', () => resolve({ status, body: Buffer.concat(chunks) }));
  req.on('error', reject);
  req.setTimeout(30000, () => req.destroy(new Error('timeout')));
});

const connect = () => new Promise((resolve, reject) => {
  const c = http2.connect(HOST, { settings: { enablePush: false } });
  c.on('connect', () => resolve(c));
  c.on('error', reject);
});

async function main() {
  const boot = await connect();
  const attrs = await get(boot, `${PREFIX}/data/${SLUG}_attributes.json`);
  if (attrs.status !== 200) throw new Error(`attributes fetch failed: ${attrs.status}`);
  const shas = Object.keys(JSON.parse(attrs.body.toString('utf8')));
  boot.close();
  console.log(`${SLUG}: ${shas.length} shas`);

  const todo = shas.filter(s => !fs.existsSync(path.join(CACHE, s + '.png')));
  console.log(`already cached ${shas.length - todo.length}, fetching ${todo.length}`);
  if (!todo.length) { fs.writeFileSync(path.join(CACHE, '_shas.json'), JSON.stringify(shas)); return; }

  // A few connections, each running a slice of the work; h2 multiplexes within each.
  const POOL = Math.min(6, Math.max(1, Math.ceil(CONC / 8)));
  const clients = await Promise.all(Array.from({ length: POOL }, connect));
  let done = 0, failed = 0, next = 0;
  const t0 = Date.now();

  const worker = async (client) => {
    for (;;) {
      const i = next++;
      if (i >= todo.length) return;
      const sha = todo[i];
      // Storage rate-limits (429) well before it runs out of bandwidth, so back
      // off and retry rather than dropping the tile.
      let ok = false;
      for (let attempt = 0; attempt < 6 && !ok; attempt++) {
        try {
          const r = await get(client, `${PREFIX}/static/images/${sha}`);
          if (r.status === 200 && r.body.length) {
            fs.writeFileSync(path.join(CACHE, sha + '.png'), r.body);
            ok = true;
          } else if (r.status === 429 || r.status >= 500) {
            await sleep(400 * 2 ** attempt + Math.random() * 400);
          } else { console.error(`  ${r.status} ${sha}`); break; }
        } catch (e) {
          await sleep(400 * 2 ** attempt + Math.random() * 400);
        }
      }
      if (!ok) failed++;
      if (++done % 500 === 0) {
        const rate = done / ((Date.now() - t0) / 1000);
        console.log(`  ${done}/${todo.length}  ${rate.toFixed(0)}/s  eta ${((todo.length - done) / rate / 60).toFixed(1)}m`);
      }
    }
  };

  const lanes = [];
  for (let i = 0; i < CONC; i++) lanes.push(worker(clients[i % POOL]));
  await Promise.all(lanes);
  clients.forEach(c => c.close());

  fs.writeFileSync(path.join(CACHE, '_shas.json'), JSON.stringify(shas));
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s, failed ${failed}`);
}

main().catch(e => { console.error(e); process.exit(1); });
