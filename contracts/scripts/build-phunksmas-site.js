/**
 * Phunksmas on the site: builds everything Supabase needs for the pieces that are MINTED right now.
 * Re-run after every drop; every INSERT is "on conflict do nothing", so re-running only adds new pieces.
 *
 * Reads the chain (free public RPC) for which ids exist, their owner, their exact stored image + traits
 * (tokenURI) and their mint tx; never trusts the local manifest for what is live.
 *
 *   node scripts/build-phunksmas-site.js
 *
 * Writes phunksmas_site/:
 *   images/{sha}                 PNGs for the static bucket (static/images/{sha}); sha = sha256(data URI), as v67
 *   phunksmas_attributes.json    for the data bucket (data/phunksmas_attributes.json); [{k,v}] per sha
 *   insert.sql                   collections row + ethscriptions rows + attributes_new rows + created events
 *   plan.json                    tokenId -> hashId, sha, owner, mint tx
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { ethers } = require('ethers');

const SLUG = 'phunksmas';
const NFT = '0x676FfE70d72B64cF505274c6D58975Ef1b2010d5';
const FIRST = 10454, LAST = 10520;
const OUT = path.join(__dirname, '..', '..', 'phunksmas_site');
const STATIC = 'https://kfnprbhoodmgfhqojmqp.supabase.co/storage/v1/object/public/static/images/';
const p = new ethers.JsonRpcProvider('https://eth.drpc.org', 1, { staticNetwork: true, batchMaxCount: 1 });
const nft = new ethers.Contract(NFT, [
  'function ownerOf(uint256) view returns (address)',
  'function tokenURI(uint256) view returns (string)',
  'function totalSupply() view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
], p);
const sha256 = (x) => crypto.createHash('sha256').update(x).digest('hex');
const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retry = async (f) => {
  for (let k = 0; ; k++) {
    try { return await f(); } catch (e) { if (k > 5) throw e; await sleep(1500); }
  }
};
/** the PNG data URI the contract stores, out of tokenURI's image (an SVG that wraps it) or the image itself */
function storedPng(image) {
  if (image.startsWith('data:image/png;base64,')) return image;
  const svg = Buffer.from(image.split('base64,')[1], 'base64').toString();
  const m = svg.match(/href="(data:image\/png;base64,[^"]+)"/);
  if (!m) throw new Error('no PNG inside the image');
  return m[1];
}

(async () => {
  const supply = Number(await retry(() => nft.totalSupply()));
  const minted = [];
  for (let id = FIRST; id <= LAST; id++) {
    const owner = await retry(() => nft.ownerOf(id)).catch(() => null);
    if (owner) minted.push({ id, owner: owner.toLowerCase() });
  }
  if (minted.length !== supply) throw new Error(`found ${minted.length} owned ids but totalSupply is ${supply}`);

  // mint txs: Transfer(from 0) for each id. drpc free plan allows <=100-block ranges; walk back from head.
  const head = await p.getBlockNumber();
  const need = new Set(minted.map((m) => m.id));
  const mints = {};
  const topic = nft.interface.getEvent('Transfer').topicHash;
  const zero = ethers.zeroPadValue('0x00', 32);
  for (let to = head; need.size && to > head - 50_000; to -= 100) {
    const logs = await retry(() => p.getLogs({ address: NFT, topics: [topic, zero], fromBlock: to - 99, toBlock: to }));
    for (const l of logs) {
      const id = Number(BigInt(l.topics[3]));
      if (need.has(id)) {
        const b = await retry(() => p.getBlock(l.blockNumber));
        mints[id] = { txHash: l.transactionHash, logIndex: l.index, blockNumber: l.blockNumber, blockHash: l.blockHash,
          txIndex: l.transactionIndex, ts: new Date(Number(b.timestamp) * 1000).toISOString(), to: ethers.getAddress('0x' + l.topics[2].slice(26)).toLowerCase() };
        need.delete(id);
      }
    }
  }
  if (need.size) throw new Error('mint tx not found for ' + [...need].join(','));

  fs.mkdirSync(path.join(OUT, 'images'), { recursive: true });
  const attrFile = {}, plan = [];
  for (const { id, owner } of minted) {
    const uri = await retry(() => nft.tokenURI(id));
    const j = JSON.parse(Buffer.from(uri.slice(uri.indexOf('base64,') + 7), 'base64').toString());
    const png = storedPng(j.image);
    const sha = sha256(png);
    const hashId = '0x' + sha256(`${SLUG}:${id}`);
    const kv = (j.attributes || []).filter((a) => a.trait_type !== 'Attribute Count').map((a) => ({ k: a.trait_type, v: String(a.value) }));
    const values = {};
    for (const { k, v } of kv) values[k] = k in values ? [].concat(values[k], v) : v;
    attrFile[sha] = kv;
    fs.writeFileSync(path.join(OUT, 'images', sha), Buffer.from(png.split('base64,')[1], 'base64'));
    plan.push({ tokenId: id, hashId, sha, owner, name: j.name, values, mint: mints[id] });
  }

  const first = plan[0];
  let sql = `-- Phunksmas on the site: ${plan.length} minted pieces (${plan.map((x) => x.tokenId).join(', ')}).\n`
    + `-- Safe to re-run after each drop: existing rows are left alone.\nbegin;\n`;
  // id given explicitly (next free), in case the identity sequence is behind hand-set ids
  sql += `insert into public.collections (id, slug, name, "singleName", description, image, supply, active, hidden, standalone, "isMinting", "hasBackgrounds", notifications, "mintEnabled", "defaultBackground")\n`
    + `select (select coalesce(max(id), 0) + 1 from public.collections), '${SLUG}', 'Phunksmas', 'Phunksmas', ${q('Phunksmas: 67 hand-made Christmas 1/1s, fully on-chain ERC-721.')}, ${q(STATIC + first.sha)}, 67, true, false, false, false, false, false, false, '#638596'\n`
    + `where not exists (select 1 from public.collections where slug = '${SLUG}');\n\n`;
  for (const x of plan) {
    sql += `insert into public.ethscriptions ("hashId", sha, "tokenId", slug, creator, owner, "prevOwner", "createdAt", locked)\n`
      + `values (${q(x.hashId)}, ${q(x.sha)}, ${x.tokenId}, '${SLUG}', ${q(x.mint.to)}, ${q(x.owner)}, ${q(x.mint.to)}, ${q(x.mint.ts)}, false)\n`
      + `on conflict ("hashId") do nothing;\n`;
    sql += `insert into public.attributes_new (sha, slug, "tokenId", "values")\n`
      + `select ${q(x.sha)}, '${SLUG}', ${x.tokenId}, ${q(JSON.stringify(x.values))}::jsonb\n`
      + `where not exists (select 1 from public.attributes_new where sha = ${q(x.sha)});\n`;
    sql += `insert into public.events ("txId", type, "hashId", "from", "to", "blockHash", "txIndex", "txHash", "blockNumber", "blockTimestamp", value)\n`
      + `values (${q(x.mint.txHash + x.mint.logIndex)}, 'created', ${q(x.hashId)}, ${q(x.mint.to)}, ${q(x.mint.to)}, ${q(x.mint.blockHash)}, ${x.mint.txIndex}, ${q(x.mint.txHash)}, ${x.mint.blockNumber}, ${q(x.mint.ts)}, '0')\n`
      + `on conflict ("txId") do nothing;\n\n`;
  }
  sql += `commit;\n\n-- check: expect ${plan.length} and ${plan.length}\n`
    + `select (select count(*) from public.ethscriptions where slug = '${SLUG}') as items, (select count(*) from public.attributes_new where slug = '${SLUG}') as traits;\n`;

  fs.writeFileSync(path.join(OUT, `${SLUG}_attributes.json`), JSON.stringify(attrFile));
  fs.writeFileSync(path.join(OUT, 'insert.sql'), sql);
  fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify(plan, null, 2));
  console.log(`minted ${plan.length}/67: ${plan.map((x) => x.tokenId).join(', ')}`);
  console.log(`wrote ${OUT}: ${plan.length} images, ${SLUG}_attributes.json, insert.sql, plan.json`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
