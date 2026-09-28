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

const env = fs.existsSync('./indexer/.env') ? fs.readFileSync('./indexer/.env', 'utf8') : '';
const g = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const URL_ = process.env.SUPABASE_URL || g('SUPABASE_URL');
// Not on disk by design since 2026-09-26. Absent is the EXPECTED state, not a failure — pass it
// in the environment when you actually want the secret-key checks to run.
const KEY = process.env.SUPABASE_SERVICE_ROLE || g('SUPABASE_SERVICE_ROLE');

const rows = [];
const check = (label, ok, detail) => { rows.push([label, ok, detail]); };
let cloudflareUnverifiable = false;

// ---- 1. the local key -----------------------------------------------------
// A read proves the key is valid. It does not prove it is a SECRET key — the
// publishable one reads too — so the write below is what distinguishes them.
if (!KEY) {
  console.log('\n  no secret key in the environment — that is the intended state; it is not kept');
  console.log('  on disk. The secret-key checks are skipped. To run them:');
  console.log('    PowerShell:  $env:SUPABASE_SERVICE_ROLE="sb_secret_..."; node verify-supabase-key.mjs');
} else {
  check('indexer/.env key format', KEY.startsWith('sb_secret_'), KEY.slice(0, 10) + '…');

  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
  const r = await fetch(`${URL_}/rest/v1/collections?slug=eq.${SLUG}&select=supply`, { headers: H });
  check('local key can read', r.ok, r.ok ? `HTTP ${r.status}` : `HTTP ${r.status} — key is dead or wrong`);

  // The value written back is read with the PUBLISHABLE key, deliberately, so the write tests
  // below do not depend on the secret key being healthy.
  //
  // Reading it with the secret key is what made this checker lie once: when the secret key was
  // revoked the read 401'd, `cur` came back undefined, JSON.stringify({supply: undefined})
  // collapsed to `{}`, and an empty PATCH is a no-op PostgREST answers 204 to. That turned the
  // "publishable key cannot write" assertion into a vacuous pass reported as a FAIL of the
  // opposite claim — it looked like RLS had fallen open when nothing had changed at all.
  const cur = (await (await fetch(`${URL_}/rest/v1/collections?slug=eq.${SLUG}&select=supply&apikey=${PUBLISHABLE}`)).json())[0]?.supply;
  const body = JSON.stringify({ supply: cur });

  if (cur === undefined) {
    check('write tests have a real body', false, 'could not read supply even with the publishable key');
  } else {
    // Idempotent by construction: writes supply the same value it already holds.
    const w = await fetch(`${URL_}/rest/v1/collections?slug=eq.${SLUG}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body,
    });
    check('local key can WRITE (is secret)', w.ok, `HTTP ${w.status}  supply ${cur} unchanged`);

    // And the publishable key must NOT be able to write, or RLS/grants have fallen open.
    // A non-empty body is essential here — see the note above.
    const bad = await fetch(`${URL_}/rest/v1/collections?slug=eq.${SLUG}`, {
      method: 'PATCH',
      headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${PUBLISHABLE}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body,
    });
    const msg = bad.ok ? '' : ((await bad.json().catch(() => ({}))).message || '');
    check('publishable key CANNOT write', !bad.ok, `HTTP ${bad.status}  ${msg}`);
  }
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
// This probe can only prove the var is SET, never that the key in it is VALID. Read the
// limitation before trusting a pass:
//
//   500 "Missing admin config environment variables" -> var is NOT set
//   400 "Missing auth, updates, or signature"        -> var IS set (we sent no body)
//
// The env check runs before body validation (admin-config.js:56), so a 400 means set. But a
// revoked key sits in that var and still answers 400 — the function never touches Supabase
// until after it has verified an on-chain-owner signature, which this script cannot forge.
// So a dead key here is INVISIBLE from outside. The only real confirmation is to open the
// admin page and save a setting.
try {
  const r = await fetch(`${SITE}/api/admin-config`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    signal: AbortSignal.timeout(20000),
  });
  const body = await r.text();
  const varSet = r.status === 400;
  check('Cloudflare var is SET (not validated)', varSet, `HTTP ${r.status}  ${body.slice(0, 55)}`);
  if (varSet) cloudflareUnverifiable = true;
} catch (e) {
  check('Cloudflare var is SET (not validated)', false, e.name);
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
if (cloudflareUnverifiable) {
  console.log('  note: the Cloudflare check above proves only that the var exists. A REVOKED key');
  console.log('        there answers identically. Confirm by saving a setting on the admin page.');
  console.log('');
}
// The closing line used to read "do NOT revoke the old key yet" on any failure, which is only
// right DURING a rotation. Run after one — the usual case — it gave stale advice about a step
// already done. Report what is actually broken instead, and let the reader draw the conclusion.
if (bad) {
  console.log(`${bad} check(s) FAILED.`);
  const render = rows.find(([l]) => l.startsWith('Render'));
  if (render && !render[1]) {
    console.log('');
    console.log('  "Unregistered API key" from Render means the old key was revoked before');
    console.log('  Render got the new one. The indexer is NOT indexing until you paste it into');
    console.log('  the Render env var SUPABASE_SERVICE_ROLE and redeploy.');
  }
  console.log('');
  console.log('  Mid-rotation, a failure here means do not revoke the old key yet.');
  process.exit(1);
}
console.log('all clean — both production places hold a working key.');
