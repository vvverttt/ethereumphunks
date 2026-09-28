// QuantumPhunk #224: Animal = Alligator -> Crocodile.
//
// #224 is the only token in the collection carrying "Alligator"; 453 others carry "Crocodile".
// After this the value disappears entirely and #224 joins the Crocodiles as the 454th.
//
// Its One of One status is NOT affected: that comes from the explicit `Special = One of One`
// attribute, which is untouched, not from the animal being unique.
//
// The image does not change, so the sha does NOT change — only the trait text moves. That
// keeps this much simpler than a slot replacement: no storage re-upload, no ethscriptions row
// edit, no hashId churn.
//
// Three layers hold the traits and all three must move together or the site disagrees with
// the chain:
//
//   1. on-chain   setTraits(224, keys, values)      <- owner tx, done on Etherscan
//   2. attributes_new.values   (sha-keyed)
//   3. data/cryptophunksv67_attributes.json (sha-keyed)
//
// This script does 2 and 3 and prints the calldata for 1.
//
//   node fix-224-alligator-to-crocodile.mjs           report + calldata
//   RUN=1 node fix-224-alligator-to-crocodile.mjs     write the Supabase layers
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JsonRpcProvider, Contract, Interface } = require('./contracts/node_modules/ethers');

const RUN = process.env.RUN === '1';
const TOKEN = 224;
const FROM = 'Alligator';
const TO = 'Crocodile';
const NFT = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';
const SLUG = 'cryptophunksv67';
const PUB = 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe';

const env = fs.existsSync('./indexer/.env') ? fs.readFileSync('./indexer/.env', 'utf8') : '';
const g = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const URL_ = process.env.SUPABASE_URL || g('SUPABASE_URL') || 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE || g('SUPABASE_SERVICE_ROLE');

if (RUN && !KEY) {
  console.error('ABORT: writing needs SUPABASE_SERVICE_ROLE in the environment.');
  console.error('  PowerShell:  $env:SUPABASE_SERVICE_ROLE="sb_secret_..."');
  console.error('               $env:RUN="1"; node fix-224-alligator-to-crocodile.mjs');
  process.exit(1);
}

// ---- 1. read the CHAIN as the source of truth -------------------------------
const p = new JsonRpcProvider(process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com', 1, { staticNetwork: true });
const nft = new Contract(NFT, [
  'function tokenURI(uint256) view returns (string)',
  'function tokenImage(uint256) view returns (string)',
  'function hasTrait(uint256,string,string) view returns (bool)',
], p);

const meta = JSON.parse(Buffer.from((await nft.tokenURI(TOKEN)).split(',')[1], 'base64').toString());
const onchain = meta.attributes.map((a) => ({ k: a.trait_type, v: String(a.value) }));

console.log(`#${TOKEN} on-chain traits:`);
for (const t of onchain) console.log(`  ${t.k.padEnd(16)} ${t.v}`);

const hit = onchain.filter((t) => t.v === FROM);
if (!hit.length) {
  console.log(`\nNothing to do: no trait with value "${FROM}".`);
  process.exit(0);
}
console.log(`\n  changing: ${hit.map((t) => `${t.k} = ${FROM} -> ${TO}`).join(', ')}`);

// The new trait arrays, preserving ORDER and every other value exactly — including
// "Attribute Count", which is stored on-chain as a real trait even though the Supabase layers
// exclude it as derived. Dropping it here would silently delete it from the token.
const newOnchain = onchain.map((t) => ({ k: t.k, v: t.v === FROM ? TO : t.v }));
const keys = newOnchain.map((t) => t.k);
const vals = newOnchain.map((t) => t.v);

const iface = new Interface(['function setTraits(uint256 t, string[] keys, string[] vals)']);
const calldata = iface.encodeFunctionData('setTraits', [TOKEN, keys, vals]);

console.log(`\n--- STEP 1: on-chain (Etherscan, Write as Proxy, from quantumphunks.eth) ---`);
console.log(`  setTraits`);
console.log(`    t     ${TOKEN}`);
console.log(`    keys  ${JSON.stringify(keys)}`);
console.log(`    vals  ${JSON.stringify(vals)}`);
console.log(`\n  raw calldata:\n  ${calldata}`);

// ---- 2. the Supabase layers -------------------------------------------------
// sha is sha256 of the IMAGE, which is unchanged — so the row is found by the same sha it
// always had, and nothing sha-keyed needs to move.
const row = (await (await fetch(`${URL_}/rest/v1/attributes_new?slug=eq.${SLUG}&tokenId=eq.${TOKEN}&select=tokenId,sha,values&apikey=${PUB}`)).json())[0];
if (!row) { console.error(`\nABORT: no attributes_new row for #${TOKEN}`); process.exit(1); }

console.log(`\n--- STEP 2/3: Supabase (sha ${row.sha.slice(0, 16)}…) ---`);

// attributes_new.values is a MAP, with repeats collapsed to an array.
const newValues = {};
for (const [k, v] of Object.entries(row.values)) {
  newValues[k] = Array.isArray(v) ? v.map((x) => (x === FROM ? TO : x)) : (v === FROM ? TO : v);
}
console.log(`  attributes_new.values  ${JSON.stringify(row.values)}`);
console.log(`                      -> ${JSON.stringify(newValues)}`);

// the bucket JSON is a flat [{k,v}] list per sha
const bucket = await (await fetch(`${URL_}/storage/v1/object/public/data/${SLUG}_attributes.json?cb=${Date.now()}`)).json();
if (!bucket[row.sha]) { console.error(`ABORT: sha not present in the bucket JSON`); process.exit(1); }
const newBucketEntry = bucket[row.sha].map((e) => ({ k: e.k, v: e.v === FROM ? TO : e.v }));
console.log(`  bucket entry           ${JSON.stringify(bucket[row.sha])}`);
console.log(`                      -> ${JSON.stringify(newBucketEntry)}`);

if (!RUN) {
  console.log(`\nDRY RUN — nothing written. Re-run with RUN=1 to write the Supabase layers.`);
  console.log(`(Do the on-chain setTraits yourself; order does not matter, but do both.)`);
  process.exit(0);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const a = await fetch(`${URL_}/rest/v1/attributes_new?sha=eq.${row.sha}`, {
  method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ values: newValues }),
});
console.log(`\n  attributes_new  ${a.ok ? 'updated' : 'FAILED ' + a.status + ' ' + (await a.text()).slice(0, 140)}`);

bucket[row.sha] = newBucketEntry;
const b = await fetch(`${URL_}/storage/v1/object/data/${SLUG}_attributes.json`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'x-upsert': 'true', 'cache-control': 'public, max-age=3600' },
  body: JSON.stringify(bucket),
});
console.log(`  bucket JSON     ${b.ok ? 'uploaded' : 'FAILED ' + b.status}   ${Object.keys(bucket).length} shas`);

// ---- verify, cache-busted ---------------------------------------------------
const after = await (await fetch(`${URL_}/storage/v1/object/public/data/${SLUG}_attributes.json?cb=${Date.now()}`)).json();
const rowAfter = (await (await fetch(`${URL_}/rest/v1/attributes_new?sha=eq.${row.sha}&select=values&apikey=${PUB}`)).json())[0];
const stillOld = JSON.stringify(after[row.sha]).includes(FROM) || JSON.stringify(rowAfter?.values).includes(FROM);
console.log(`\n  verify: "${FROM}" still present in Supabase? ${stillOld ? 'YES — INVESTIGATE' : 'no'}`);
console.log(`  on-chain still says "${FROM}"? ${await nft.hasTrait(TOKEN, hit[0].k, FROM) ? 'YES — do the setTraits tx' : 'no'}`);
console.log(`\nAfter the on-chain tx lands, re-run this to confirm both sides agree.`);
