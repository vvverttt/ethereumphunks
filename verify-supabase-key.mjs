// Check a Supabase key rotation landed everywhere, before revoking the old key.
//
// The secret key is in THREE places, not the two that are obvious:
//
//   1. indexer/.env                     local        var SUPABASE_SERVICE_ROLE
//   2. Render env (the indexer)         production   var SUPABASE_SERVICE_ROLE
//   3. Cloudflare Pages env             production   var SUPABASE_SERVICE_ROLE_KEY   <- different name
//
// #3 is the one that gets missed: marketplace/functions/api/admin-config.js is a Pages
// Function, so it runs on Cloudflare with its own env, not Render's. Revoking the old key
// without updating it breaks admin config writes silently — the page just stops saving.
//
// The frontend is deliberately NOT in that list. It uses the independent `sb_publishable_`
// key, so rotating the secret needs no rebuild and no redeploy. This script proves that
// rather than assuming it.
//
//   node verify-supabase-key.mjs
import fs from 'fs';

const PUBLISHABLE = 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe';
const SLUG = 'cryptophunksv67';
const INDEXER = 'https://ethereumphunks.onrender.com';
const SITE = 'https://quantumphunks.com';

const env = fs.readFileSync('./indexer/.env', 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const URL_ = g('SUPABASE_URL');
const KEY = g('SUPABASE_SERVICE_ROLE');

const rows = [];
const check = (label, ok, detail) => { rows.push([label, ok, detail]); };

// ---- 1. the local key -----------------------------------------------------
// A read proves the key is valid. It does not prove it is a SECRET key — the
// publishable one reads too — so the write below is what distinguishes them.
if (!KEY) {
  check('indexer/.env has a key', false, 'SUPABASE_SERVICE_ROLE missing');
} else {
  check('indexer/.env key format', KEY.startsWith('sb_secret_'), KEY.slice(0, 10) + '…');

  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
  const r = await fetch(`${URL_}/rest/v1/collections?slug=eq.${SLUG}&select=supply`, { headers: H });
  check('local key can read', r.ok, `HTTP ${r.status}`);

  // Write test: PATCH supply to the value it already holds. Idempotent by construction —
  // reads the current value first and writes that same value back, so a pass changes nothing.
  const cur = (await (await fetch(`${URL_}/rest/v1/collections?slug=eq.${SLUG}&select=supply`, { headers: H })).json())[0]?.supply;
  const w = await fetch(`${URL_}/rest/v1/collections?slug=eq.${SLUG}`, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ supply: cur }),
  });
  check('local key can WRITE (is secret)', w.ok, `HTTP ${w.status}  supply ${cur} unchanged`);

  // And the publishable key must NOT be able to write, or RLS is open.
  const bad = await fetch(`${URL_}/rest/v1/collections?slug=eq.${SLUG}`, {
    method: 'PATCH',
    headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${PUBLISHABLE}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ supply: cur }),
  });
  check('publishable key CANNOT write', !bad.ok, `HTTP ${bad.status}`);
}

// ---- 2. Render (the indexer) ----------------------------------------------
// /admin/health is the right probe rather than a plain liveness ping: it calls
// storageSvc.getLastBlock(), and StorageService is the thing constructed with
// SUPABASE_SERVICE_ROLE (storage.service.ts:22). So a 200 carrying a real lastIndexed
// proves Render's key can actually READ Supabase — not merely that the process booted.
//
// A 503 with an error means the key is bad. A 503 with a large gap means the key is fine
// and the indexer is just behind; those are different problems and the body separates them.
try {
  const r = await fetch(`${INDEXER}/admin/health`, { signal: AbortSignal.timeout(90000) });
  const b = await r.json().catch(() => ({}));
  const supabaseOk = typeof b.lastIndexed === 'number';
  check('Render key reads Supabase', supabaseOk,
    supabaseOk ? `lastIndexed ${b.lastIndexed}  gap ${b.gap}` : `HTTP ${r.status}  ${JSON.stringify(b).slice(0, 80)}`);
  if (supabaseOk && !b.ok) check('Render indexer keeping up', false, `gap ${b.gap} > ${b.threshold} (separate issue, not the key)`);
} catch (e) {
  check('Render key reads Supabase', false, `${e.name} — free tier cold start can take ~50s, retry`);
}

// ---- 3. Cloudflare Pages (the admin-config function) ---------------------
// Distinguishing the two failure modes is the whole point:
//   500 "Missing admin config environment variables" -> the key is NOT set
//   400 "Missing auth, updates, or signature"        -> the key IS set, we just sent no body
// The env check runs before body validation (admin-config.js:56), so a 400 is the pass.
try {
  const r = await fetch(`${SITE}/api/admin-config`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    signal: AbortSignal.timeout(20000),
  });
  const body = await r.text();
  const keySet = r.status === 400;
  check('Cloudflare Pages has the key', keySet, `HTTP ${r.status}  ${body.slice(0, 60)}`);
} catch (e) {
  check('Cloudflare Pages has the key', false, e.name);
}

// ---- 4. the frontend read path (must be untouched by rotation) -----------
const pub = await fetch(`${URL_}/rest/v1/ethscriptions?slug=eq.${SLUG}&select=tokenId&apikey=${PUBLISHABLE}`, { headers: { Prefer: 'count=exact', Range: '0-0' } });
const total = (pub.headers.get('content-range') || '').split('/')[1];
check('site still reads (publishable key)', pub.ok && total === '10000', `HTTP ${pub.status}  ${total} tokens`);

// ---- report ---------------------------------------------------------------
console.log('');
let bad = 0;
for (const [label, ok, detail] of rows) {
  if (!ok) bad++;
  console.log(`  [${ok ? 'OK  ' : 'FAIL'}] ${label.padEnd(34)} ${detail || ''}`);
}
console.log('');
if (bad) {
  console.log(`${bad} check(s) FAILED — do NOT revoke the old key yet.`);
  process.exit(1);
}
console.log('all clean — safe to revoke the old key in the Supabase dashboard.');
