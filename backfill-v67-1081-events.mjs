// Give the final 1,081 their activity history, so they show up on the site like every other
// token.
//
// They were written to `ethscriptions` and `attributes_new` but never to `events`, so the grid
// lists them while Recent Activity, the per-token history and anything reading `events` shows
// nothing. Measured before writing this: all 8,919 older tokens have events, all 1,081 new ones
// have zero.
//
// Why not the existing backfill-v67-events.mjs: it selects its targets with
// `is_erc721_only=is.true`, and that column does not exist on `ethscriptions` (the live table is
// createdAt/creator/owner/hashId/sha/tokenId/prevOwner/slug/oldHashId/locked/name). So it
// matches nothing now.
//
// This picks its targets by the actual symptom instead — every v67 token with no row in
// `events` — which is self-correcting, needs no flag, and makes the script safe to re-run: once
// a token has events it drops out of the target set on its own.
//
// Rows are built to match what the indexer's nft.service.ts buildEvent would have written, so
// backfilled history is indistinguishable from live-indexed history:
//
//   txId = txHash + logIndex      the conflict target, so re-running is a no-op
//   mint (from 0x0)  -> type 'created', from = to = receiver   (matches the older rows)
//   otherwise        -> type 'transfer'
//
//   node backfill-v67-1081-events.mjs          report only
//   RUN=1 node backfill-v67-1081-events.mjs    write
import fs from 'fs';

const RUN = process.env.RUN === '1';
const NFT = '0x67b850c3c8790cc7ec76261b65fde60efb6f1fe3';
const SLUG = 'cryptophunksv67';
const ZERO = '0x0000000000000000000000000000000000000000';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const FROM_BLOCK = Number(process.env.FROM_BLOCK || 25760000);
const CHUNK = Number(process.env.CHUNK || 7500);   // drpc's free tier caps getLogs at 10k blocks
const PUB = 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe';
const RPCS = ['https://eth.drpc.org', 'https://rpc.mevblocker.io', 'https://ethereum-rpc.publicnode.com'];

const env = fs.existsSync('./indexer/.env') ? fs.readFileSync('./indexer/.env', 'utf8') : '';
const g = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const URL_ = process.env.SUPABASE_URL || g('SUPABASE_URL') || 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE || g('SUPABASE_SERVICE_ROLE');

if (RUN && !KEY) {
  console.error('ABORT: writing needs SUPABASE_SERVICE_ROLE in the environment.');
  console.error('  PowerShell:  $env:SUPABASE_SERVICE_ROLE="sb_secret_..."');
  console.error('               $env:RUN="1"; node backfill-v67-1081-events.mjs');
  process.exit(1);
}
// Reading is done with the publishable key, so the report runs without any secret.
const RH = { apikey: KEY || PUB, Authorization: `Bearer ${KEY || PUB}`, 'Content-Type': 'application/json' };

let rr = 0;
async function rpc(method, params) {
  let last;
  for (let a = 0; a < RPCS.length * 4; a++) {
    try {
      const r = await (await fetch(RPCS[rr++ % RPCS.length], {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(40000),
      })).json();
      if (!r.error) return r.result;
      last = new Error(r.error.message);
    } catch (e) { last = e; }
    await new Promise((x) => setTimeout(x, 300));
  }
  throw last;
}

const page = async (table, qs) => {
  const out = [];
  for (let f = 0; ; f += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${table}?${qs}`, { headers: { ...RH, Range: `${f}-${f + 999}` } });
    const p = await r.json();
    if (!Array.isArray(p)) throw new Error(`${table}: ${JSON.stringify(p).slice(0, 160)}`);
    out.push(...p);
    if (p.length < 1000) break;
  }
  return out;
};

// ---- who needs events -----------------------------------------------------
const tokens = await page('ethscriptions', `slug=eq.${SLUG}&select=tokenId,hashId&order=tokenId.asc`);
const events0 = await page('events', 'select=hashId');
const haveEvents = new Set(events0.map((e) => e.hashId));
const targets = tokens.filter((t) => !haveEvents.has(t.hashId));
const hashOf = new Map(targets.map((t) => [t.tokenId, t.hashId]));

console.log(`v67 tokens          ${tokens.length}`);
console.log(`already have events ${tokens.length - targets.length}`);
console.log(`NEED events         ${targets.length}\n`);
if (!targets.length) { console.log('nothing to do — every token already has history.'); process.exit(0); }

// ---- replay their Transfer logs -------------------------------------------
const head = Number(BigInt(await rpc('eth_blockNumber', [])));
console.log(`replaying Transfer logs ${FROM_BLOCK} -> ${head}`);
const logs = [];
const seen = new Set();
for (let b = FROM_BLOCK; b <= head; b += CHUNK) {
  const to = Math.min(b + CHUNK - 1, head);
  const got = await rpc('eth_getLogs', [{
    address: NFT, topics: [TRANSFER],
    fromBlock: '0x' + b.toString(16), toBlock: '0x' + to.toString(16),
  }]);
  for (const l of (got || [])) {
    const id = Number(BigInt(l.topics[3]));
    if (hashOf.has(id)) { logs.push(l); seen.add(id); }
  }
  process.stdout.write(`\r  block ${to}/${head}   matched ${logs.length} logs for ${seen.size}/${targets.length} tokens   `);
}
console.log('');

// Every target must have been found, or the block range is too narrow and writing now would
// leave a partial history that looks complete.
const notFound = targets.filter((t) => !seen.has(t.tokenId));
if (notFound.length) {
  console.error(`\nABORT: ${notFound.length} tokens had no Transfer log in ${FROM_BLOCK}..${head}`);
  console.error(`  e.g. ${notFound.slice(0, 10).map((t) => '#' + t.tokenId).join(', ')}`);
  console.error('  Widen the window with FROM_BLOCK=<earlier block>.');
  process.exit(1);
}

// ---- block timestamps, one call per distinct block -------------------------
const blockNums = [...new Set(logs.map((l) => l.blockNumber))];
console.log(`fetching ${blockNums.length} block timestamps…`);
const ts = new Map();
for (let i = 0; i < blockNums.length; i += 8) {
  await Promise.all(blockNums.slice(i, i + 8).map(async (bn) => {
    const b = await rpc('eth_getBlockByNumber', [bn, false]);
    if (b) ts.set(bn, new Date(Number(BigInt(b.timestamp)) * 1000).toISOString());
  }));
  process.stdout.write(`\r  ${Math.min(i + 8, blockNums.length)}/${blockNums.length}`);
}
console.log('');

// ---- build rows exactly as the indexer would -------------------------------
const out = [];
for (const l of logs) {
  const tokenId = Number(BigInt(l.topics[3]));
  const from = ('0x' + l.topics[1].slice(26)).toLowerCase();
  const to = ('0x' + l.topics[2].slice(26)).toLowerCase();
  const mint = from === ZERO;
  out.push({
    txId: l.transactionHash + Number(BigInt(l.logIndex)),
    type: mint ? 'created' : 'transfer',
    hashId: hashOf.get(tokenId).toLowerCase(),
    from: mint ? to : from,          // a mint records receiver -> receiver, like the older rows
    to,
    blockHash: l.blockHash,
    txIndex: Number(BigInt(l.transactionIndex)),
    txHash: l.transactionHash,
    blockNumber: Number(BigInt(l.blockNumber)),
    blockTimestamp: ts.get(l.blockNumber),
    value: '0',
  });
}

const byType = {};
for (const e of out) byType[e.type] = (byType[e.type] || 0) + 1;
const withCreated = new Set(out.filter((e) => e.type === 'created').map((e) => e.hashId));
console.log(`\nevents to write: ${out.length}   ${JSON.stringify(byType)}`);
console.log(`tokens that get a 'created': ${withCreated.size}/${targets.length}`);

const noTs = out.filter((e) => !e.blockTimestamp);
if (noTs.length) { console.error(`ABORT: ${noTs.length} events have no block timestamp`); process.exit(1); }
// Recent Activity lists 'created', so a token without one stays invisible there.
if (withCreated.size !== targets.length) {
  console.error(`ABORT: ${targets.length - withCreated.size} tokens would get no 'created' event`);
  process.exit(1);
}

fs.writeFileSync('./v67_1081_events_sample.json', JSON.stringify(out.slice(0, 15), null, 2));
console.log(`sample -> v67_1081_events_sample.json`);
console.log(`range: block ${Math.min(...out.map((e) => e.blockNumber))} .. ${Math.max(...out.map((e) => e.blockNumber))}`);
console.log(`dates: ${out.reduce((a, e) => e.blockTimestamp < a ? e.blockTimestamp : a, '9')} .. ${out.reduce((a, e) => e.blockTimestamp > a ? e.blockTimestamp : a, '0')}`);

if (!RUN) { console.log('\nDRY RUN — re-run with RUN=1'); process.exit(0); }

let done = 0, failed = 0;
for (let i = 0; i < out.length; i += 250) {
  const slice = out.slice(i, i + 250);
  let ok = false;
  for (let a = 0; a < 4 && !ok; a++) {
    const r = await fetch(`${URL_}/rest/v1/events?on_conflict=txId`, {
      method: 'POST', headers: { ...RH, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(slice),
    });
    if (r.ok) ok = true;
    else if (a === 3) { console.error(`\n  ${r.status} ${(await r.text()).slice(0, 200)}`); failed += slice.length; }
    else await new Promise((x) => setTimeout(x, 500 * (a + 1)));
  }
  if (ok) done += slice.length;
  process.stdout.write(`\r  written ${done}/${out.length}  failed ${failed}`);
}
console.log(`\n\ndone: ${done} written, ${failed} failed`);
console.log('verify:  node verify-v67-10k.mjs');
