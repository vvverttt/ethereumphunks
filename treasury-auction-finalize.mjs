// Final reserve list for the treasury auction.
//
//   36 items with a sale history -> 6.7x their last sale (already computed)
//   11 of the 13 never-sold      -> the priced group's median
//   #10196                       -> 0.67 ETH, priced by hand
//   #10197                       -> HELD BACK, not for sale
//
// Also re-derives reserveWei exactly from the rounded ETH figure: the first pass went
// through a float, so 2.01 ETH had been stored as 2009999999999999787 wei.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { parseEther } = require('./contracts/node_modules/ethers');
import fs from 'fs';

const SRC = './v67_new1066/treasury-auction-reserves.json';
const OUT = './v67_new1066/treasury-auction-final.json';

const HOLD = new Set([10197]);
const BY_HAND = new Map([[10196, 0.67]]);

const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const rs = src.priced.map((p) => p.reserveEth).sort((a, b) => a - b);
const MEDIAN = Number(rs[Math.floor(rs.length / 2)].toFixed(6));

const wei = (eth) => parseEther(String(eth)).toString();

const lots = [];
for (const p of src.priced) {
  lots.push({ ...p, reserveWei: wei(p.reserveEth), basis: `6.7x last sale (${p.lastSale} on ${p.lastSaleDate})` });
}
const held = [];
for (const u of src.unpriced) {
  if (HOLD.has(u.tokenId)) { held.push({ ...u, reason: 'not for sale' }); continue; }
  const eth = BY_HAND.get(u.tokenId) ?? MEDIAN;
  lots.push({
    ...u, lastSale: null, lastSaleDate: null,
    reserveEth: eth, reserveWei: wei(eth),
    basis: BY_HAND.has(u.tokenId) ? 'never sold — priced by hand' : `never sold — median of the priced group (${MEDIAN})`,
  });
}
lots.sort((a, b) => b.reserveEth - a.reserveEth);

const total = lots.reduce((s, l) => s + l.reserveEth, 0);
console.log(`${lots.length} lots for auction, ${held.length} held back\n`);
console.log('  token   collection      reserve      basis');
for (const l of lots) {
  console.log(`  #${String(l.tokenId).padEnd(6)} ${l.slug.padEnd(15)} ${l.reserveEth.toFixed(4)} ETH   ${l.basis}`);
}
console.log(`\n  held back: ${held.map((h) => '#' + h.tokenId).join(', ') || 'none'}`);
console.log(`  median used for the never-sold: ${MEDIAN} ETH`);
console.log(`  total if every lot clears at reserve: ${total.toFixed(3)} ETH`);

fs.writeFileSync(OUT, JSON.stringify({
  note: '6.7x last sale where there is one; median for never-sold; #10196 by hand; #10197 held back',
  built_at: new Date().toISOString(),
  multiplier: src.multiplier,
  medianEth: MEDIAN,
  holder: src.holder,
  lots, held,
}, null, 2));
console.log(`\nwrote ${OUT}`);
