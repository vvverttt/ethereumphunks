// Pack the bundled collection images into a handful of sprite sheets.
//
//   node build-sprite.mjs <buildDir> [--prune] [--chunk N]
//
// Why: the IPFS bundle carries one file per image, which is 9,497 files averaging
// 1.2 KB. That shape is hostile to everything downstream — pinning services meter
// file count, folder uploads stall on it, and a grid page costs one request per
// tile. Virtually all of the art is 24x24, so it packs into sheets very cheaply.
//
// Why several sheets rather than one: a single sheet holding every tile came to
// 4.99 MB, which would have to download in full before the first phunk appeared.
// Splitting it means a page pulls only the sheets it actually shows. Tiles are
// ordered by collection then token id, so items browsed together land together
// and a page of 250 normally touches one or two sheets.
//
// Produces, under static/:
//   sprite-0.png … sprite-N.png   — the sheets, `chunk` tiles each
//   sprite.json                   — { tile, cols, chunk, prefix, count, shas }
//
// `shas` is one long string of fixed-width sha prefixes; a sha's ordinal position
// in it is its tile index. Prefixes rather than full hashes because the full list
// costs 614 KB and the prefix that is still collision-free costs a fraction of it.
//
// Anything that is not the dominant tile size (the ~700x990 rock art, a few GIFs)
// stays its own file and keeps resolving the old way. The sheets are an
// optimisation layer, never the only source, so a sha missing from them still loads.
//
// --prune deletes the individual files that made it into a sheet. Without it
// nothing is removed, so the output can be inspected before committing to it.

import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const PRUNE = process.argv.includes('--prune');
const chunkIdx = process.argv.indexOf('--chunk');
const CHUNK = chunkIdx !== -1 ? Number(process.argv[chunkIdx + 1]) : 512;

// `--config <name>` resolves the dated build dir from angular.json, the same way
// bundle-static-assets.mjs and copy-to-fixed.js do, so the date cannot drift.
const cfgIdx = process.argv.indexOf('--config');
const BUILD = cfgIdx !== -1
  ? path.join(
      HERE,
      JSON.parse(fs.readFileSync(path.join(HERE, 'angular.json'), 'utf8'))
        .projects['etherphunks-market'].architect.build.configurations[process.argv[cfgIdx + 1]].outputPath.base,
      'browser',
    )
  : process.argv[2];

const HOST = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const KEY = 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe';

if (!BUILD || !fs.existsSync(path.join(BUILD, 'index.html'))) {
  console.error('usage: node build-sprite.mjs <buildDir> [--prune] [--chunk N]');
  process.exit(1);
}

const staticDir = path.join(BUILD, 'static');
const imgDir = path.join(staticDir, 'images');
if (!fs.existsSync(imgDir)) {
  console.error(`no images to pack at ${imgDir} — run bundle-static-assets.mjs first`);
  process.exit(1);
}

/** PNG dimensions straight from the IHDR chunk, or null when it is not a PNG. */
function pngSize(file) {
  const buf = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/**
 * Animated PNGs carry an `acTL` chunk. A sheet can only hold one frame, so packing
 * one silently flattens it to its first frame and the art stops moving. 26 of these
 * exist in the collection and all of them were being flattened, so they are excluded
 * and keep their own file.
 */
function isAnimated(file) {
  // acTL must appear before the first IDAT; reading the head is enough and avoids
  // pulling every image fully into memory.
  const buf = Buffer.alloc(4096);
  const fd = fs.openSync(file, 'r');
  const read = fs.readSync(fd, buf, 0, 4096, 0);
  fs.closeSync(fd);
  return buf.subarray(0, read).includes(Buffer.from('acTL'));
}

const names = fs.readdirSync(imgDir);
console.log(`scanning ${names.length} images…`);

// Group by dimensions so the dominant tile size is found rather than assumed.
const sizes = new Map();
let animated = 0;
for (const n of names) {
  const full = path.join(imgDir, n);
  const d = pngSize(full);
  if (d && isAnimated(full)) { animated++; continue; } // keeps its own file
  const key = d ? `${d.w}x${d.h}` : 'not-png';
  if (!sizes.has(key)) sizes.set(key, []);
  sizes.get(key).push(n);
}
if (animated) console.log(`${animated} animated PNGs excluded — a sheet cannot hold more than one frame`);

const [tileKey, packable] = [...sizes.entries()]
  .filter(([k]) => k !== 'not-png')
  .sort((a, b) => b[1].length - a[1].length)[0];

const [TILE, TILE_H] = tileKey.split('x').map(Number);
if (TILE !== TILE_H) {
  console.error(`dominant tile ${tileKey} is not square — the layout assumes square tiles`);
  process.exit(1);
}
console.log(`dominant tile ${tileKey}: ${packable.length} images  (${names.length - packable.length} left as separate files)`);

// Order by collection then token id, so a page of consecutive items maps onto one
// sheet. Anything the table does not know about is appended in name order.
const order = new Map();
for (let offset = 0; ; offset += 1000) {
  const url = `${HOST}/rest/v1/ethscriptions?select=sha,slug,tokenId&limit=1000&offset=${offset}&apikey=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ethscriptions fetch failed at offset ${offset}: ${res.status}`);
  const rows = await res.json();
  for (const r of rows) if (r.sha) order.set(r.sha, [r.slug || '~', Number(r.tokenId) || 0]);
  if (rows.length < 1000) break;
}
console.log(`ordering from ${order.size} indexed rows\n`);

const packed = packable.slice().sort((a, b) => {
  const A = order.get(a) || ['~~', 0];
  const B = order.get(b) || ['~~', 0];
  if (A[0] !== B[0]) return A[0] < B[0] ? -1 : 1;
  if (A[1] !== B[1]) return A[1] - B[1];
  return a < b ? -1 : 1;
});

// Shortest sha prefix that is still collision-free, to keep the index small.
let PREFIX = 8;
while (PREFIX < 64 && new Set(packed.map((s) => s.slice(0, PREFIX))).size !== packed.length) PREFIX += 2;
if (new Set(packed.map((s) => s.slice(0, PREFIX))).size !== packed.length) {
  console.error('no collision-free sha prefix — refusing to build an ambiguous index');
  process.exit(1);
}

const cols = Math.ceil(Math.sqrt(CHUNK));
const rowsPerSheet = Math.ceil(CHUNK / cols);
const sheetCount = Math.ceil(packed.length / CHUNK);
console.log(`${sheetCount} sheets of ${CHUNK} tiles (${cols} x ${rowsPerSheet} = ${cols * TILE} x ${rowsPerSheet * TILE} px), sha prefix ${PREFIX} chars\n`);

let total = 0;
for (let s = 0; s < sheetCount; s++) {
  const slice = packed.slice(s * CHUNK, (s + 1) * CHUNK);
  const sheet = new PNG({ width: cols * TILE, height: rowsPerSheet * TILE });
  sheet.data.fill(0); // transparent ground; phunk art relies on alpha

  for (let i = 0; i < slice.length; i++) {
    const src = PNG.sync.read(fs.readFileSync(path.join(imgDir, slice[i])));
    const ox = (i % cols) * TILE;
    const oy = Math.floor(i / cols) * TILE;
    for (let y = 0; y < TILE; y++) {
      const from = y * src.width * 4;
      const to = ((oy + y) * sheet.width + ox) * 4;
      src.data.copy(sheet.data, to, from, from + TILE * 4);
    }
  }

  const out = PNG.sync.write(sheet, { deflateLevel: 9 });
  fs.writeFileSync(path.join(staticDir, `sprite-${s}.png`), out);
  total += out.length;
  if ((s + 1) % 5 === 0 || s === sheetCount - 1) console.log(`  sheet ${s + 1}/${sheetCount}`);
}

const index = {
  tile: TILE,
  cols,
  chunk: CHUNK,
  prefix: PREFIX,
  count: packed.length,
  shas: packed.map((s) => s.slice(0, PREFIX)).join(''),
};
fs.writeFileSync(path.join(staticDir, 'sprite.json'), JSON.stringify(index));

const before = packed.reduce((a, n) => a + fs.statSync(path.join(imgDir, n)).size, 0);
const indexBytes = fs.statSync(path.join(staticDir, 'sprite.json')).size;
console.log(
  `\nsheets      ${(total / 1048576).toFixed(2)} MB across ${sheetCount} files` +
  `   (avg ${(total / sheetCount / 1024).toFixed(0)} KB — what one page costs)`
);
console.log(`sprite.json ${(indexBytes / 1024).toFixed(0)} KB`);
console.log(`replaces    ${packed.length} files totalling ${(before / 1048576).toFixed(2)} MB`);

if (PRUNE) {
  for (const n of packed) fs.unlinkSync(path.join(imgDir, n));
  const left = fs.readdirSync(imgDir).length;
  const files = fs.readdirSync(BUILD, { recursive: true }).length;
  console.log(`\npruned ${packed.length} individual images; ${left} remain, ~${files} files in the build`);
} else {
  console.log(`\nnothing deleted (pass --prune to remove the ${packed.length} packed files)`);
}
