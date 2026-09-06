// Pack a build folder into a single CAR and pin that to Pinata.
//
//   node deploy-car.mjs [buildDir]
//   (default: dist/etherphunks-market-ipfs/browser)
//
// Why not deploy-ipfs.js: that uploads every file as its own part in one
// fileArray call. With images bundled the folder holds ~9,800 files, which
// the browser uploader and the multipart request both choke on ("Error
// uploading file: Unknown"). A CAR is one file no matter how many entries
// the DAG has, so the file count stops mattering.
//
// The root CID is computed locally first and checked against what Pinata
// returns — if they differ, Pinata pinned something other than our DAG and
// the ENS contenthash must NOT be updated.

import { PinataSDK } from 'pinata';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// deploy-ipfs.js only loads `.env`; credentials here usually live in .env.local.
dotenv.config({ path: '.env.local' });
dotenv.config();

const BUILD = process.argv[2] || 'dist/etherphunks-market-ipfs/browser';
const CAR = process.argv[3] || 'dist/site.car';

if (!fs.existsSync(path.join(BUILD, 'index.html'))) {
  console.error(`not a build dir (no index.html): ${BUILD}`); process.exit(1);
}
const jwt = process.env.PINATA_JWT;
if (!jwt) {
  console.error('PINATA_JWT not set. Put it in marketplace/.env.local (gitignored):');
  console.error('  PINATA_JWT=eyJ...');
  process.exit(1);
}

const files = (() => { let n = 0; (function w(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? w(path.join(d, e.name)) : n++;
})(BUILD); return n; })();

console.log(`build : ${BUILD}  (${files} files)`);
console.log('packing CAR...');
fs.mkdirSync(path.dirname(CAR), { recursive: true });

// --no-wrap so index.html sits at the DAG root, which is what an ENS
// contenthash resolves against.
const localCid = execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['--yes', 'ipfs-car@latest', 'pack', BUILD, '--no-wrap', '--output', CAR],
  { encoding: 'utf8' }
).trim();

const size = fs.statSync(CAR).size;
console.log(`CAR   : ${CAR}  (${(size / 1048576).toFixed(1)} MB)`);
console.log(`local root CID : ${localCid}`);

const pinata = new PinataSDK({ pinataJwt: jwt, pinataGateway: process.env.PINATA_GATEWAY_DOMAIN || undefined });

console.log('\nuploading to Pinata as a CAR...');
const blob = new Blob([fs.readFileSync(CAR)]);
const file = new File([blob], 'site.car', { type: 'application/vnd.ipld.car' });

const res = await pinata.upload.public.file(file).car();
const remoteCid = res.cid || res.IpfsHash;
console.log(`pinned CID     : ${remoteCid}`);

if (remoteCid !== localCid) {
  console.error('\nCID MISMATCH — Pinata pinned a different DAG than we packed.');
  console.error('Do NOT update the ENS contenthash. Likely the CAR was stored as a');
  console.error('plain file rather than expanded; check the SDK version supports .car().');
  process.exit(1);
}

console.log('\nCID matches the locally computed root.');
console.log('\nNext: set the ENS contenthash for your name to');
console.log(`  ipfs://${remoteCid}`);
console.log('Until that is updated, .eth.limo keeps serving the previous pin.');
