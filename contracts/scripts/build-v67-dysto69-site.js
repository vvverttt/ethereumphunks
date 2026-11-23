/**
 * Site side of the 69 Dysto overwrite: the contract now carries the new art + traits, the site still
 * shows the old ones (it reads Supabase, and the build bundles from Supabase). Builds everything locally:
 *   v67_dysto69/site/images/{newSha}          new PNGs named by sha (sha = sha256 of the data URI, as live)
 *   v67_dysto69/site/cryptophunksv67_attributes.json   live file with the 69 old sha entries swapped
 *   v67_dysto69/site/update.sql               ethscriptions.sha + attributes_new (sha, values) for the 69
 *   v67_dysto69/site/plan.json                tokenId -> hashId, oldSha, newSha
 *   node scripts/build-v67-dysto69-site.js            build only (reads public data, writes nothing remote)
 *   node scripts/build-v67-dysto69-site.js --apply    upload images + attributes file, apply the row updates
 *     --apply needs SUPABASE_SECRET (sb_secret_...) from ~/.secrets/supabase.env, never from the repo.
 */
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const U = 'https://kfnprbhoodmgfhqojmqp.supabase.co', PUB = 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe';
const SLUG = 'cryptophunksv67', ROOT = path.join(__dirname, '..', '..', 'v67_dysto69'), OUT = path.join(ROOT, 'site');
const sha256 = (x) => crypto.createHash('sha256').update(x).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, key = PUB, asBuf = false) {
  for (let k = 0; ; k++) {
    const r = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' });
    if (r.ok) return asBuf ? Buffer.from(await r.arrayBuffer()) : r.json();
    if (k > 5) throw new Error(`${r.status} ${url}`);
    await sleep(1500);
  }
}
const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;

(async () => {
  const uris = JSON.parse(fs.readFileSync(path.join(ROOT, 'dataURIs.json'), 'utf8'));
  const traits = JSON.parse(fs.readFileSync(path.join(ROOT, 'setTraits.json'), 'utf8'));
  const ids = Object.keys(uris).map(Number).sort((a, b) => a - b);
  if (ids.length !== 69) throw new Error('expected 69');

  const rows = await get(`${U}/rest/v1/ethscriptions?slug=eq.${SLUG}&tokenId=in.(${ids.join(',')})&select=hashId,sha,tokenId`);
  if (rows.length !== 69) throw new Error(`ethscriptions rows ${rows.length} != 69`);
  const byId = Object.fromEntries(rows.map((r) => [r.tokenId, r]));
  const attrFile = await get(`${U}/storage/v1/object/public/data/${SLUG}_attributes.json`);
  const before = Object.keys(attrFile).length;

  fs.mkdirSync(path.join(OUT, 'images'), { recursive: true });
  const plan = [];
  let sql = `-- 69 Dysto overwrite: point the site rows at the new art + traits. hashId (and so listings/events) unchanged.\nbegin;\n`;
  for (const id of ids) {
    const row = byId[id];
    if (row.hashId !== '0x' + sha256(`${SLUG}:${id}`)) throw new Error('unexpected hashId for ' + id);
    const newSha = sha256(uris[id]);
    if (attrFile[newSha]) throw new Error('new sha already present ' + id);
    // site format: [{k,v}] in on-chain order, repeats kept, no stored Attribute Count (live entries omit it)
    const kv = traits[id].keys.map((k, i) => ({ k, v: traits[id].vals[i] })).filter((x) => x.k !== 'Attribute Count');
    // attributes_new.values: object, repeated keys become arrays (as live, e.g. Special: [Character, One of One])
    const values = {};
    for (const { k, v } of kv) values[k] = k in values ? [].concat(values[k], v) : v;
    if (!attrFile[row.sha]) throw new Error('old sha missing from attributes file ' + id);
    delete attrFile[row.sha];
    attrFile[newSha] = kv;
    fs.writeFileSync(path.join(OUT, 'images', newSha), Buffer.from(uris[id].split('base64,')[1], 'base64'));
    plan.push({ tokenId: id, hashId: row.hashId, oldSha: row.sha, newSha, values });
    sql += `update public.ethscriptions set sha = ${sqlStr(newSha)} where "hashId" = ${sqlStr(row.hashId)} and slug = '${SLUG}' and sha = ${sqlStr(row.sha)};\n`;
    sql += `update public.attributes_new set sha = ${sqlStr(newSha)}, "values" = ${sqlStr(JSON.stringify(values))}::jsonb where slug = '${SLUG}' and "tokenId" = ${id} and sha = ${sqlStr(row.sha)};\n`;
  }
  sql += `commit;\n`;
  if (Object.keys(attrFile).length !== before) throw new Error('attributes file entry count changed');
  fs.writeFileSync(path.join(OUT, `${SLUG}_attributes.json`), JSON.stringify(attrFile));
  fs.writeFileSync(path.join(OUT, 'update.sql'), sql);
  fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify(plan, null, 2));
  // keep a copy of the live file exactly as it was, for rollback
  fs.writeFileSync(path.join(ROOT, 'backup', `${SLUG}_attributes.live.json`), JSON.stringify(await get(`${U}/storage/v1/object/public/data/${SLUG}_attributes.json`)));
  console.log(`built ${OUT}: 69 images, attributes file (${before} entries), update.sql, plan.json`);

  if (!process.argv.includes('--apply')) return;
  const envFile = path.join(os.homedir(), '.secrets', 'supabase.env');
  if (fs.existsSync(envFile)) require('dotenv').config({ path: envFile, override: true });
  const KEY = process.env.SUPABASE_SECRET;
  if (!KEY || !KEY.startsWith('sb_secret_')) throw new Error(`put SUPABASE_SECRET=sb_secret_... in ${envFile}`);
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const put = async (bucket, name, body, type, cache) => {
    for (let k = 0; ; k++) {
      const r = await fetch(`${U}/storage/v1/object/${bucket}/${name}`, { method: 'POST', headers: { ...H, 'content-type': type, 'cache-control': cache, 'x-upsert': 'true' }, body });
      if (r.ok) return;
      if (k > 5) throw new Error(`upload ${bucket}/${name}: ${r.status} ${await r.text()}`);
      await sleep(1500);
    }
  };
  for (const p of plan) await put('static', `images/${p.newSha}`, fs.readFileSync(path.join(OUT, 'images', p.newSha)), 'image/png', 'public, max-age=31536000, immutable');
  console.log('uploaded 69 images');
  for (const p of plan) {
    const patch = async (table, filter, body) => {
      const r = await fetch(`${U}/rest/v1/${table}?${filter}`, { method: 'PATCH', headers: { ...H, 'content-type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok || j.length !== 1) throw new Error(`${table} ${p.tokenId}: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    };
    await patch('ethscriptions', `hashId=eq.${p.hashId}&slug=eq.${SLUG}&sha=eq.${p.oldSha}`, { sha: p.newSha });
    await patch('attributes_new', `slug=eq.${SLUG}&tokenId=eq.${p.tokenId}&sha=eq.${p.oldSha}`, { sha: p.newSha, values: p.values });
  }
  console.log('updated 69 ethscriptions + 69 attributes_new rows');
  await put('data', `${SLUG}_attributes.json`, fs.readFileSync(path.join(OUT, `${SLUG}_attributes.json`)), 'application/json', 'no-cache');
  console.log('uploaded attributes file');

  // read back through the public key
  const back = await get(`${U}/rest/v1/ethscriptions?slug=eq.${SLUG}&tokenId=in.(${ids.join(',')})&select=sha,tokenId`);
  const file = await get(`${U}/storage/v1/object/public/data/${SLUG}_attributes.json?t=${Date.now()}`);
  let ok = 0;
  for (const p of plan) {
    const img = await get(`${U}/storage/v1/object/public/static/images/${p.newSha}`, PUB, true);
    if (back.find((b) => b.tokenId === p.tokenId)?.sha === p.newSha && file[p.newSha] && !file[p.oldSha] && sha256('data:image/png;base64,' + img.toString('base64')) === p.newSha) ok++;
  }
  console.log(`read-back OK ${ok}/69`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
