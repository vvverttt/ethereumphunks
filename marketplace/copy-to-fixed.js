// After `ng build`, mirror the DATED output folder (kept as-is for the .eth.limo IPFS re-pin) to a
// FIXED path, so Cloudflare Pages can point its "build output directory" at a stable location that
// never changes with the date. Without this, prebuild.js renames the output to dist/…_<today> every
// build, and Cloudflare's fixed output-dir setting stops matching → deploys silently fail.
//
// Reads the exact dated path prebuild.js just wrote into angular.json (no date recompute, so it can't
// drift across a midnight boundary between prebuild and this step).
//
//   dist/etherphunks-market-mainnet_jul24  ->  dist/etherphunks-market-mainnet
//   Cloudflare output dir  ->  dist/etherphunks-market-mainnet/browser
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = process.argv[2]; // 'mainnet' | 'sepolia'
if (!config) {
  console.error('usage: node copy-to-fixed.js <mainnet|sepolia>');
  process.exit(1);
}

const angularJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'angular.json'), 'utf8'));
const datedBase =
  angularJson.projects['etherphunks-market'].architect.build.configurations[config].outputPath.base;
const fixedBase = datedBase.replace(/_[a-z]+\d+$/i, ''); // strip the _jul24 suffix

const src = path.join(__dirname, datedBase);
const dest = path.join(__dirname, fixedBase);

if (!fs.existsSync(src)) {
  console.error(`source build not found: ${src} — did ng build run?`);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true });
console.log(`Cloudflare fixed output dir: ${fixedBase}/browser  (mirrored from ${datedBase})`);
