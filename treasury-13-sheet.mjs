// Contact sheet of the 13 treasury items that have never sold, so they can be eyeballed
// together rather than as a list of numbers. Writes an HTML page; a screenshot follows.
import fs from 'fs';

const HOST = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const KEY = 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe';
const IDS = [10082, 10091, 10096, 10097, 10127, 10141, 10181, 10185, 10196, 10197, 10217, 10239, 10240];

const attrs = await (await fetch(`${HOST}/storage/v1/object/public/data/og-missing-phunks_attributes.json`)).json();
const rows = [];
for (let off = 0; ; off += 1000) {
  const r = await fetch(`${HOST}/rest/v1/ethscriptions?select=sha,tokenId,hashId&slug=eq.missing-phunks&limit=1000&offset=${off}&apikey=${KEY}`);
  const p = await r.json();
  rows.push(...p);
  if (p.length < 1000) break;
}
const byId = new Map(rows.map((r) => [r.tokenId, r]));

// Trait rarity across the collection, so the sheet says something about each piece
// rather than only showing it.
const freq = new Map();
for (const list of Object.values(attrs)) for (const a of list || []) freq.set(`${a.k}|${a.v}`, (freq.get(`${a.k}|${a.v}`) || 0) + 1);

const cards = IDS.map((id) => {
  const row = byId.get(id);
  if (!row) return `<div class="card missing"><div class="id">#${id}</div><p>not found</p></div>`;
  const list = attrs[row.sha] || [];
  const traits = list.map((a) => {
    const n = freq.get(`${a.k}|${a.v}`) || 0;
    return `<li><span>${a.v}</span><b>${n}</b></li>`;
  }).join('');
  const rarest = Math.min(...list.filter((a) => a.k !== 'Attribute Count').map((a) => freq.get(`${a.k}|${a.v}`) || 999));
  return `<div class="card">
    <img src="${HOST}/storage/v1/object/public/static/images/${row.sha}" alt="#${id}">
    <div class="id">#${id}</div>
    <div class="rare">rarest trait seen ${rarest}x</div>
    <ul>${traits}</ul>
  </div>`;
}).join('');

const html = `<!doctype html><meta charset="utf-8"><title>13 never sold</title>
<style>
 body{margin:0;background:#0c141a;color:#e6f1f7;font:13px/1.4 ui-monospace,Menlo,Consolas,monospace;padding:28px}
 h1{font-size:20px;margin:0 0 4px}
 .sub{color:#7b96a6;margin-bottom:22px}
 .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
 .card{background:#121d26;border:1px solid #1f3340;padding:12px}
 .card img{display:block;width:100%;image-rendering:pixelated;background:#67cdff}
 .id{font-size:16px;font-weight:700;color:#67cdff;margin:10px 0 2px}
 .rare{color:#7b96a6;margin-bottom:8px}
 ul{list-style:none;margin:0;padding:0}
 li{display:flex;justify-content:space-between;gap:8px;padding:1px 0;color:#b9cdd9}
 li b{color:#67cdff;font-weight:400}
 .missing{color:#ff7a7a}
</style>
<h1>13 treasury items that have never sold</h1>
<div class="sub">all missing-phunks &middot; no sale history, so no 6.7x reserve could be computed &middot; numbers are how many pieces in the collection share that trait</div>
<div class="grid">${cards}</div>`;

fs.writeFileSync('./v67_new1066/treasury-13.html', html);
console.log('wrote v67_new1066/treasury-13.html');
for (const id of IDS) {
  const r = byId.get(id);
  console.log(`  #${id}  ${r ? r.sha.slice(0, 16) + '…' : 'NOT FOUND'}`);
}
