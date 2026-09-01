// Pack a collection's per-sha PNGs into sprite sheets + an index, then verify
// every tile round-trips pixel-identically.
//
//   node build-image-atlas.mjs <cacheDir> <outDir> [--tile=24] [--cols=96]
//
// Only tiles matching the collection's dominant size are packed. Anything else
// (odd dimensions, animated GIFs) is listed in `fallback` and must keep using
// the per-sha URL, so nothing is dropped or resized.

import fs from 'fs';
import path from 'path';
import { PNG } from './marketplace/node_modules/pngjs/lib/png.js';

const args = process.argv.slice(2);
const CACHE = args[0];
const OUT = args[1];
const opt = (n, d) => { const a = args.find(x => x.startsWith(`--${n}=`)); return a ? Number(a.split('=')[1]) : d; };
const TILE = opt('tile', 24);
const COLS = opt('cols', 96);

if (!CACHE || !OUT) { console.error('usage: node build-image-atlas.mjs <cacheDir> <outDir> [--tile=24] [--cols=96]'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

const shas = JSON.parse(fs.readFileSync(path.join(CACHE, '_shas.json'), 'utf8'));
console.log(`${shas.length} shas, tile ${TILE}px, ${COLS} cols/sheet`);

// ---- decode pass -----------------------------------------------------------
const tiles = [];      // { sha, png }
const fallback = [];   // shas that cannot be packed
const sizes = {};
let alphaBinary = true, alphaPartialCount = 0, anyAlpha = false;

for (const sha of shas) {
  const f = path.join(CACHE, sha + '.png');
  if (!fs.existsSync(f)) { fallback.push({ sha, why: 'missing' }); continue; }
  const buf = fs.readFileSync(f);
  let png;
  try { png = PNG.sync.read(buf); }
  catch { fallback.push({ sha, why: 'not-a-png' }); continue; }

  const key = `${png.width}x${png.height}`;
  sizes[key] = (sizes[key] || 0) + 1;
  if (png.width !== TILE || png.height !== TILE) { fallback.push({ sha, why: key }); continue; }

  for (let i = 3; i < png.data.length; i += 4) {
    const a = png.data[i];
    if (a !== 255) anyAlpha = true;
    if (a !== 0 && a !== 255) { alphaBinary = false; alphaPartialCount++; }
  }
  tiles.push({ sha, png });
}

console.log('\nsize histogram:');
Object.entries(sizes).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k.padEnd(12)} ${v}`));
console.log(`\npackable ${tiles.length}, fallback ${fallback.length}`);
console.log(`alpha: present=${anyAlpha} binary=${alphaBinary} partial-pixels=${alphaPartialCount}`);
if (!alphaBinary) {
  console.log('  ! semi-transparent pixels exist — a canvas slice may drift by a step.');
  console.log('    Slice with getImageData/putImageData (no compositing) to stay exact.');
}

// ---- pack ------------------------------------------------------------------
const PER_SHEET = COLS * COLS;
const sheetCount = Math.ceil(tiles.length / PER_SHEET) || 1;
const index = { tile: TILE, cols: COLS, sheets: [], map: {}, fallback: fallback.map(f => f.sha) };

for (let s = 0; s < sheetCount; s++) {
  const slice = tiles.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
  const rows = Math.ceil(slice.length / COLS);
  const sheet = new PNG({ width: COLS * TILE, height: rows * TILE });
  sheet.data.fill(0);

  slice.forEach((t, i) => {
    const cx = (i % COLS) * TILE, cy = Math.floor(i / COLS) * TILE;
    // straight row copy — no scaling, no compositing, bytes land verbatim
    for (let y = 0; y < TILE; y++) {
      const src = y * TILE * 4;
      const dst = ((cy + y) * sheet.width + cx) * 4;
      t.png.data.copy(sheet.data, dst, src, src + TILE * 4);
    }
    index.map[t.sha] = [s, i % COLS, Math.floor(i / COLS)];
  });

  const name = `sheet-${s}.png`;
  const buf = PNG.sync.write(sheet, { colorType: 6, deflateLevel: 9 });
  fs.writeFileSync(path.join(OUT, name), buf);
  index.sheets.push({ file: name, w: sheet.width, h: sheet.height, count: slice.length, bytes: buf.length });
  console.log(`  ${name}  ${sheet.width}x${sheet.height}  ${slice.length} tiles  ${(buf.length / 1048576).toFixed(2)} MB`);
}

fs.writeFileSync(path.join(OUT, 'atlas-index.json'), JSON.stringify(index));
const idxBytes = fs.statSync(path.join(OUT, 'atlas-index.json')).size;
const sheetBytes = index.sheets.reduce((s, x) => s + x.bytes, 0);
console.log(`\nindex ${(idxBytes / 1024).toFixed(0)} KB, sheets ${(sheetBytes / 1048576).toFixed(2)} MB`);

// ---- verify ----------------------------------------------------------------
console.log('\nverifying every tile against its source PNG...');
const decoded = index.sheets.map(s => PNG.sync.read(fs.readFileSync(path.join(OUT, s.file))));
let checked = 0, bad = 0;
for (const t of tiles) {
  const [s, col, row] = index.map[t.sha];
  const sheet = decoded[s];
  const cx = col * TILE, cy = row * TILE;
  for (let y = 0; y < TILE && !bad; y++) {
    const a = t.png.data.subarray(y * TILE * 4, y * TILE * 4 + TILE * 4);
    const off = ((cy + y) * sheet.width + cx) * 4;
    const b = sheet.data.subarray(off, off + TILE * 4);
    if (Buffer.compare(a, b) !== 0) { bad++; console.error(`  MISMATCH ${t.sha} row ${y}`); }
  }
  checked++;
}
console.log(bad === 0
  ? `PASS — ${checked}/${tiles.length} tiles byte-identical to source`
  : `FAIL — ${bad} mismatched tiles`);

const totalSource = tiles.reduce((s, t) => s + fs.statSync(path.join(CACHE, t.sha + '.png')).size, 0);
console.log(`\nsource total ${(totalSource / 1048576).toFixed(2)} MB across ${tiles.length} requests`);
console.log(`atlas  total ${(sheetBytes / 1048576).toFixed(2)} MB across ${index.sheets.length} request(s)`);
process.exit(bad === 0 ? 0 : 1);
