// Prepare everything Supabase needs for the final 1,081, so the site shows all 10,000.
//
// These tokens are ERC-721 only — there is no ethscription behind them — which is the
// same shape as the 4,667 batch. Conventions copied from what that batch actually wrote:
//
//   sha     = sha256(tokenImage(id))          the data-URI STRING, not the png bytes
//   hashId  = 0x + sha256("cryptophunksv67:<id>")  surrogate row key
//   image   = static/images/{sha}             no file extension
//   values  = { Trait: value | [values] }     a MAP, multi-value collapses to an array
//
// Everything is read from the chain, so nothing here can drift from what is deployed.
// Writes three files; no network writes, no key needed.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JsonRpcProvider, Contract, Interface } = require('./contracts/node_modules/ethers');
import fs from 'fs';
import { createHash } from 'crypto';

const V67 = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const SLUG = 'cryptophunksv67';
const OUT = './v67_new1066';

const p = new JsonRpcProvider(process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com', 1, { staticNetwork: true });
const nft = new Contract(V67, [
  'function tokenImage(uint256) view returns (string)',
  'function ownerOf(uint256) view returns (address)',
  'function tokenURI(uint256) view returns (string)',
], p);
const mc = new Interface(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) view returns ((bool success,bytes returnData)[])']);

const ids = [
  ...Object.keys(JSON.parse(fs.readFileSync(`${OUT}/dataURIs-1054.json`, 'utf8'))).map(Number),
  ...JSON.parse(fs.readFileSync(`${OUT}/turtle-drop-12.json`, 'utf8')).turtleSlots,
].sort((a, b) => a - b);

if (ids.length !== 1081) throw new Error(`expected 1,081 ids, got ${ids.length}`);
console.log(`${ids.length} tokens to prepare\n`);

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const rows = [];
const images = {};

for (let i = 0; i < ids.length; i += 25) {
  const slice = ids.slice(i, i + 25);
  const calls = [];
  for (const t of slice) {
    calls.push({ target: V67, allowFailure: true, callData: nft.interface.encodeFunctionData('tokenImage', [t]) });
    calls.push({ target: V67, allowFailure: true, callData: nft.interface.encodeFunctionData('ownerOf', [t]) });
    calls.push({ target: V67, allowFailure: true, callData: nft.interface.encodeFunctionData('tokenURI', [t]) });
  }
  const [res] = mc.decodeFunctionResult('aggregate3', await p.call({ to: MULTICALL3, data: mc.encodeFunctionData('aggregate3', [calls]) }));

  slice.forEach((id, k) => {
    const img = nft.interface.decodeFunctionResult('tokenImage', res[k * 3].returnData)[0];
    const owner = nft.interface.decodeFunctionResult('ownerOf', res[k * 3 + 1].returnData)[0].toLowerCase();
    const uri = nft.interface.decodeFunctionResult('tokenURI', res[k * 3 + 2].returnData)[0];
    const meta = JSON.parse(Buffer.from(uri.split(',')[1], 'base64').toString());

    // `values` is a map; a trait that appears twice (two Hair entries, say) becomes an array.
    const values = {};
    for (const a of meta.attributes || []) {
      if (a.trait_type === 'Attribute Count') continue;   // derived, not stored as a trait
      if (values[a.trait_type] === undefined) values[a.trait_type] = a.value;
      else if (Array.isArray(values[a.trait_type])) values[a.trait_type].push(a.value);
      else values[a.trait_type] = [values[a.trait_type], a.value];
    }

    const sha = sha256(img);
    rows.push({ tokenId: id, sha, values, owner });
    images[sha] = img;
  });
  process.stdout.write(`\r  read ${Math.min(i + 25, ids.length)}/${ids.length}   `);
}
process.stdout.write('\r                          \r');

// No two tokens may share a sha — that would collapse them in every sha-keyed layer.
const shas = new Set(rows.map((r) => r.sha));
if (shas.size !== rows.length) throw new Error(`${rows.length - shas.size} duplicate shas`);

// And none may collide with what is already in the collection.
const KEY = 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe';
const live = new Set();
for (let f = 0; ; f += 1000) {
  const r = await fetch(`https://kfnprbhoodmgfhqojmqp.supabase.co/rest/v1/ethscriptions?slug=eq.${SLUG}&select=sha,tokenId&apikey=${KEY}`,
    { headers: { Range: `${f}-${f + 999}` } });
  const page = await r.json();
  for (const x of page) live.add(x.sha);
  if (page.length < 1000) break;
}
const clash = rows.filter((r) => live.has(r.sha));

console.log(`prepared ${rows.length} rows`);
console.log(`  unique shas            ${shas.size}`);
console.log(`  already in Supabase    ${clash.length}${clash.length ? ' -> ' + clash.slice(0, 5).map((c) => c.tokenId).join(', ') : ''}`);
console.log(`  owners                 ${new Set(rows.map((r) => r.owner)).size} distinct`);
console.log(`  avg traits             ${(rows.reduce((s, r) => s + Object.keys(r.values).length, 0) / rows.length).toFixed(2)}`);

fs.writeFileSync(`${OUT}/v67-1081-attributes-new.json`, JSON.stringify(rows.map(({ tokenId, sha, values }) => ({ tokenId, sha, values })), null, 2));
fs.writeFileSync(`${OUT}/v67-1081-owners.json`, JSON.stringify(Object.fromEntries(rows.map((r) => [r.tokenId, r.owner])), null, 2));
fs.writeFileSync(`${OUT}/v67-1081-images.json`, JSON.stringify(images));

console.log(`\nwrote:`);
console.log(`  ${OUT}/v67-1081-attributes-new.json   rows for attributes_new + ethscriptions`);
console.log(`  ${OUT}/v67-1081-owners.json           tokenId -> owner`);
console.log(`  ${OUT}/v67-1081-images.json           sha -> data URI, for the storage upload`);
console.log(`\nsample: #${rows[0].tokenId}  sha ${rows[0].sha.slice(0, 16)}…  ${JSON.stringify(rows[0].values).slice(0, 90)}`);
