// Recolour the browser/PWA icons from the lime accent to the QuantumPhunks blue.
//
//   node recolor-icons.mjs [--check]
//
// The tab icon was the site's old lime (#c3ff00) while every QuantumPhunks surface —
// header, tiles, splash, theme-color meta and the manifest — is #67cdff. In a tab
// strip the icon is the only branding visible, so the mismatch was the most obvious
// thing about it.
//
// Artwork is preserved rather than redrawn: every pixel is a blend between the lime
// and black, so each one is re-blended between the blue and black at the same ratio.
// Fully lime becomes fully blue, black stays black, and the anti-aliased edge pixels
// keep their exact weighting.
//
// --check reports what would change without writing.

import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const CHECK = process.argv.includes('--check');

const FROM = { r: 0xc3, g: 0xff, b: 0x00 };   // lime
const TO   = { r: 0x67, g: 0xcd, b: 0xff };   // #67cdff

/** How far this pixel sits between black and the lime, judged on the channel with the most range. */
function blend(r, g, b) {
  const t = Math.max(r / FROM.r, g / FROM.g);
  // Anything that is not on the lime/black ramp is left alone.
  const onRamp =
    Math.abs(r - FROM.r * t) <= 12 &&
    Math.abs(g - FROM.g * t) <= 12 &&
    b <= 24;
  if (!onRamp) return null;
  return {
    r: Math.round(TO.r * t),
    g: Math.round(TO.g * t),
    b: Math.round(TO.b * t),
  };
}

let filesChanged = 0;

// ── favicon.ico: single 32x32 32bpp BMP, bottom-up BGRA ──────────────────────
const icoPath = path.join(HERE, 'src', 'favicon.ico');
if (fs.existsSync(icoPath)) {
  const b = fs.readFileSync(icoPath);
  const off = b.readUInt32LE(6 + 12);
  const hdr = b.readUInt32LE(off);
  const w = b.readInt32LE(off + 4);
  const rows = b.readInt32LE(off + 8) / 2;    // height is doubled by the AND mask
  const bpp = b.readUInt16LE(off + 14);

  if (bpp !== 32) {
    console.error(`favicon.ico is ${bpp}bpp — expected 32; leaving it alone`);
  } else {
    const pix = off + hdr;
    let changed = 0;
    for (let i = 0; i < w * rows; i++) {
      const p = pix + i * 4;
      const out = blend(b[p + 2], b[p + 1], b[p]);
      if (!out) continue;
      b[p] = out.b; b[p + 1] = out.g; b[p + 2] = out.r;
      changed++;
    }
    if (!CHECK) fs.writeFileSync(icoPath, b);
    console.log(`favicon.ico            ${changed}/${w * rows} px recoloured`);
    if (changed) filesChanged++;
  }
}

// ── PWA icons ────────────────────────────────────────────────────────────────
const iconDir = path.join(HERE, 'src', 'assets', 'icons');
if (fs.existsSync(iconDir)) {
  // Only the PWA icon set. The folder also holds 1/2/3.png, which are large artwork
  // that merely contains some lime — recolouring those would alter real images.
  for (const f of fs.readdirSync(iconDir).filter(n => /^icon-\d+x\d+\.png$/.test(n))) {
    const p = path.join(iconDir, f);
    const png = PNG.sync.read(fs.readFileSync(p));
    let changed = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i + 3] === 0) continue;     // transparent
      const out = blend(png.data[i], png.data[i + 1], png.data[i + 2]);
      if (!out) continue;
      png.data[i] = out.r; png.data[i + 1] = out.g; png.data[i + 2] = out.b;
      changed++;
    }
    if (changed && !CHECK) fs.writeFileSync(p, PNG.sync.write(png, { deflateLevel: 9 }));
    console.log(`${f.padEnd(22)} ${changed}/${png.width * png.height} px recoloured`);
    if (changed) filesChanged++;
  }
}

console.log(CHECK ? `\n(check only — ${filesChanged} files would change)` : `\n${filesChanged} files rewritten`);
