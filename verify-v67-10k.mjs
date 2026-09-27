// The five-assertion sweep. Every one must be zero.
//
// These layers drift apart when only some are written, and nothing errors when they do —
// the counts just quietly disagree. It has bitten this collection three times: images
// missing from storage, traits blank on the site, and eight turtles vanishing from the
// grid because `ethscriptions.sha` moved while `attributes_new` kept the old one.
//
// Compares against the LIVE bucket JSON, never a repo copy — the repo copy is stale and
// merging from it silently drops One-of-One badges.
const HOST = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const KEY = 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe';
const SLUG = 'cryptophunksv67';

const page = async (table, select) => {
  const out = [];
  for (let f = 0; ; f += 1000) {
    const r = await fetch(`${HOST}/rest/v1/${table}?slug=eq.${SLUG}&select=${select}&apikey=${KEY}`, { headers: { Range: `${f}-${f + 999}` } });
    const p = await r.json();
    out.push(...p);
    if (p.length < 1000) break;
  }
  return out;
};

const eths = await page('ethscriptions', 'tokenId,sha,hashId,owner');
const attrs = await page('attributes_new', 'tokenId,sha,values');
// Cache-buster: Supabase fronts storage with a CDN that keeps serving the pre-upload
// copy for a while. Without this the sweep reports a drift that does not exist.
const bucket = await (await fetch(`${HOST}/storage/v1/object/public/data/${SLUG}_attributes.json?v=${Date.now()}`)).json();

console.log(`ethscriptions   ${eths.length}`);
console.log(`attributes_new  ${attrs.length}`);
console.log(`bucket JSON     ${Object.keys(bucket).length} shas\n`);

const attrBySha = new Map(attrs.map((a) => [a.sha, a]));
const ethShas = new Set(eths.map((e) => e.sha));

// 1. every token has an attributes_new row (the grid's join; a miss = invisible token)
const noAttrRow = eths.filter((e) => !attrBySha.has(e.sha));

// 2. every token's sha is in the bucket JSON (what the attributes page reads)
const notInBucket = eths.filter((e) => !bucket[e.sha]);

// 3. no orphan attributes_new rows — a sha no token points at
const orphans = attrs.filter((a) => !ethShas.has(a.sha));

// 4. attributes_new values agree with the bucket JSON
const norm = (v) => JSON.stringify(Object.entries(v || {}).flatMap(([k, x]) => Array.isArray(x) ? x.map((y) => [k, y]) : [[k, x]]).sort());
const normBucket = (list) => JSON.stringify((list || []).map((e) => [e.k, e.v]).sort());
const valueMismatch = eths.filter((e) => {
  const a = attrBySha.get(e.sha);
  return a && normBucket(bucket[e.sha]) !== norm(a.values);
});

// 5. attributes_new.tokenId agrees with ethscriptions
const tokenIdMismatch = eths.filter((e) => {
  const a = attrBySha.get(e.sha);
  return a && a.tokenId !== e.tokenId;
});

const rows = [
  ['tokens with no attributes_new row', noAttrRow],
  ['tokens missing from the bucket JSON', notInBucket],
  ['orphan attributes_new rows', orphans],
  ['values disagree with the bucket JSON', valueMismatch],
  ['tokenId disagrees with ethscriptions', tokenIdMismatch],
];

let bad = 0;
for (const [label, list] of rows) {
  if (list.length) bad++;
  const ids = list.slice(0, 8).map((x) => '#' + x.tokenId).join(', ');
  console.log(`  [${list.length === 0 ? 'OK  ' : 'FAIL'}] ${label.padEnd(38)} ${list.length}${ids ? '  ' + ids : ''}`);
}

// supply + a spot check that the art actually resolves
const cnt = await fetch(`${HOST}/rest/v1/ethscriptions?slug=eq.${SLUG}&select=tokenId&apikey=${KEY}`, { headers: { Prefer: 'count=exact', Range: '0-0' } });
const total = (cnt.headers.get('content-range') || '').split('/')[1];
const coll = await (await fetch(`${HOST}/rest/v1/collections?slug=eq.${SLUG}&select=supply&apikey=${KEY}`)).json();
console.log(`\n  rows ${total}   collections.supply ${coll[0]?.supply}   ${String(total) === String(coll[0]?.supply) ? 'agree' : 'DISAGREE'}`);

const sample = eths.filter((e) => [4, 103, 9998].includes(e.tokenId));
console.log('\n  art resolves:');
for (const s of sample) {
  const r = await fetch(`${HOST}/storage/v1/object/public/static/images/${s.sha}`, { method: 'HEAD' });
  console.log(`    #${String(s.tokenId).padEnd(6)} HTTP ${r.status}  ${r.headers.get('content-length') || '?'} bytes`);
}

console.log(bad ? `\n${bad} assertion(s) FAILED` : '\nall five clean');
