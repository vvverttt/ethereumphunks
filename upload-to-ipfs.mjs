import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PinataSDK } from 'pinata';

const JWT = process.env.PINATA_JWT;
if (!JWT) { console.error('Set PINATA_JWT env var'); process.exit(1); }

const pinata = new PinataSDK({ pinataJwt: JWT });

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)),
  'marketplace/dist/etherphunks-market-mainnet_apr19/browser');

function getFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) files = files.concat(getFiles(full, rel));
    else files.push({ full, rel });
  }
  return files;
}

const allFiles = getFiles(DIR);
console.log(`Uploading ${allFiles.length} files...`);

const fileObjects = allFiles.map(f => {
  const buf = fs.readFileSync(f.full);
  return new File([buf], f.rel);
});

const result = await pinata.upload.public.fileArray(fileObjects);

console.log('\n✅ CID:', result.cid);
console.log('🌐 Preview: https://ipfs.io/ipfs/' + result.cid);
console.log('🌐 eth.limo will be: https://quantumphunks.eth.limo');
