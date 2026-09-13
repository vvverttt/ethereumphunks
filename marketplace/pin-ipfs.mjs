// Pin a built site folder to Pinata and print the CID to put in the ENS contenthash.
//
//   node pin-ipfs.mjs <buildDir> [--car <file>]
//   node pin-ipfs.mjs --config mainnet-ipfs [--car <file>]
//
// The --config form reads the dated output path out of angular.json, the same way
// bundle-static-assets.mjs and copy-to-fixed.js do, so the folder never has to be
// named by hand.
//
// Why this exists alongside deploy-ipfs.js: that script uploads through the SDK's
// fileArray helper, and Pinata's own docs say folder uploads must go through the
// legacy /pinning/pinFileToIPFS endpoint. Since the build started carrying ~9.5k
// bundled images, the folder is 9,762 files, which is where browser folder uploads
// and file-array uploads fall over ("Error uploading file: Unknown").
//
// Two routes, tried in order:
//   1. CAR  — one request carrying a single 23 MB archive, and the root CID is
//             decided locally so it is known before upload. Paid plans only.
//   2. Folder — the legacy multipart endpoint, one part per file. Works on any
//             plan but is the fragile path at this file count.
//
// Needs PINATA_JWT in marketplace/.env (or the environment).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const carIdx = args.indexOf('--car');
const CAR = carIdx !== -1 ? args[carIdx + 1] : null;

const cfgIdx = args.indexOf('--config');
const BUILD = cfgIdx !== -1
  ? path.join(
      __dirname,
      JSON.parse(fs.readFileSync(path.join(__dirname, 'angular.json'), 'utf8'))
        .projects['etherphunks-market'].architect.build.configurations[args[cfgIdx + 1]].outputPath.base,
      'browser',
    )
  : args[0];

if (!BUILD || !fs.existsSync(path.join(BUILD, 'index.html'))) {
  console.error('usage: node pin-ipfs.mjs <buildDir> [--car <file>]');
  console.error('       node pin-ipfs.mjs --config mainnet-ipfs [--car <file>]');
  console.error(`       build dir must contain index.html (looked in ${BUILD})`);
  process.exit(1);
}

const JWT = process.env.PINATA_JWT;
if (!JWT) {
  console.error('Missing PINATA_JWT. Create an API key at app.pinata.cloud/developers/api-keys');
  console.error('then add it to marketplace/.env as:  PINATA_JWT=eyJ...');
  process.exit(1);
}

const auth = { authorization: `Bearer ${JWT}` };
const name = path.basename(path.resolve(BUILD, '..')) || 'etherphunks-market';

/** Every file in the build, as paths relative to the build dir. */
function walk(dir, rel = '') {
  const out = [];
  for (const item of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, item);
    const r = rel ? `${rel}/${item}` : item;
    if (fs.statSync(full).isDirectory()) out.push(...walk(full, r));
    else out.push({ full, rel: r });
  }
  return out;
}

async function uploadCar(carPath) {
  const stat = fs.statSync(carPath);
  console.log(`CAR route: ${carPath} (${(stat.size / 1048576).toFixed(2)} MB)`);

  const form = new FormData();
  form.append('file', new File([fs.readFileSync(carPath)], path.basename(carPath)));
  form.append('network', 'public');
  form.append('car', 'true');
  form.append('name', name);

  const res = await fetch('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: auth,
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`CAR upload ${res.status}: ${text}`);
  return JSON.parse(text)?.data?.cid;
}

async function uploadFolder(buildDir) {
  const files = walk(buildDir);
  const bytes = files.reduce((a, f) => a + fs.statSync(f.full).size, 0);
  console.log(`folder route: ${files.length} files (${(bytes / 1048576).toFixed(2)} MB)`);

  const form = new FormData();
  for (const f of files) {
    // Pinata derives the directory structure from a shared first path segment,
    // so every part is named `<name>/<relative path>`.
    form.append('file', new File([fs.readFileSync(f.full)], `${name}/${f.rel}`));
  }
  form.append('pinataMetadata', JSON.stringify({ name }));
  form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: auth,
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`folder upload ${res.status}: ${text}`);
  return JSON.parse(text)?.IpfsHash;
}

let cid;
if (CAR && fs.existsSync(CAR)) {
  try {
    cid = await uploadCar(CAR);
  } catch (e) {
    // A free plan rejects CAR uploads outright; fall through rather than stop.
    console.log(`CAR route failed, falling back to the folder endpoint.\n  ${e.message}\n`);
  }
}
if (!cid) cid = await uploadFolder(BUILD);

if (!cid) throw new Error('upload returned no CID');

console.log(`\nCID: ${cid}`);
console.log(`\nCheck it before switching ENS over:`);
console.log(`  curl -sI https://${cid}.ipfs.dweb.link/index.html`);
console.log(`\nThen set the quantumphunks.eth contenthash to:`);
console.log(`  ipfs://${cid}`);
