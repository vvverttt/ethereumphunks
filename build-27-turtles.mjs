// Build the final 27 turtles into our payload format.
//
// The delivered pop_27.json put the POP PALETTE name into `Skin Tone` (Radioactive,
// Flamingo, Galaxy…). Our Skin Tone is `<Era> <Character>`, and tracking.csv carries those
// as separate columns — all 27 resolve to a Skin Tone value already in the collection, so
// the name is rebuilt from the CSV rather than invented.
//
// Also adds what the export omitted: `Animal=Turtle` (without it these do not count as
// turtles and the 4,267 target is missed) and `Attribute Count` last, as every other token
// in the collection carries.
//
// Live has 21 Skin Tone values split across two casings ("OG Promo Leonardo" 38 vs
// "Og Promo Leonardo" 24). We join the dominant one and change nothing that exists.
import fs from 'fs';

const SRC = 'C:/Users/alber/OneDrive/Desktop/The 4 10K Final/1769 and 2500 with 1 of 1s no shell/2500test/max_trait_27_turtles/pop_27';
const OUT = './v67_new1066';
const HOST = 'https://kfnprbhoodmgfhqojmqp.supabase.co';

// Slot order taken from the 1,054 already on chain — they are the same drop, and their
// ordering is far more consistent than the live 8,919 (which mixes several eras of
// tagging). Emotion is absent there, so it sits where the live collection puts it
// relative to its neighbours: after Face, before Beard.
const ORDER = ['Type','Weapon','Lips','Face','Cheeks','Variant','Neck','Teeth','Emotion','Beard','Nose','Hair','Ears','Eyes','Ring','Animal','Skin Tone'];
const slots = JSON.parse(fs.readFileSync(`${OUT}/turtle-drop-12.json`, 'utf8')).turtleSlots.slice().sort((a, b) => a - b);
const pop = JSON.parse(fs.readFileSync(`${SRC}/pop_27.json`, 'utf8')).collection_items;
const csv = fs.readFileSync(`${SRC}/tracking.csv`, 'utf8').trim().split(/\r?\n/);
const head = csv[0].split(',').map((h) => h.trim());
const rows = csv.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [head[i], v.trim()])));

if (pop.length !== 27 || rows.length !== 27 || slots.length !== 27) throw new Error('expected 27 of each');

// Dominant casing for every Skin Tone value already in the collection.
const live = await (await fetch(`${HOST}/storage/v1/object/public/data/cryptophunksv67_attributes.json`)).json();
const tones = new Map();
for (const l of Object.values(live)) for (const a of l || []) if (a.k === 'Skin Tone') tones.set(a.v, (tones.get(a.v) || 0) + 1);
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const best = new Map();
for (const [v, n] of tones) {
  const k = norm(v);
  if (!best.has(k) || n > best.get(k).n) best.set(k, { v, n });
}

const uris = {}, traits = {}, report = [];
for (let i = 0; i < 27; i++) {
  const id = slots[i];
  const item = pop[i];
  const row = rows[i];
  if (item.index !== i + 1 || Number(row.id) !== i + 1) throw new Error(`row ${i + 1} is out of order`);

  const want = `${row.era} ${row.character}`;
  const tone = best.get(norm(want));
  if (!tone) throw new Error(`#${id}: "${want}" is not a Skin Tone in the collection`);

  // Keep everything the artist set except Skin Tone, which is rebuilt from era+character.
  const set = item.attributes
    .filter((a) => a.trait_type !== 'Skin Tone')
    .map((a) => [a.trait_type, a.value]);
  set.push(['Animal', 'Turtle'], ['Skin Tone', tone.v]);

  // House slot order, derived from the 1,054 already on chain — Animal always before
  // Skin Tone (988/988 there), Attribute Count always last.
  set.sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
  const unknown = set.filter(([k]) => !ORDER.includes(k));
  if (unknown.length) throw new Error(`#${id}: trait_type not in the house order: ${unknown.map((u) => u[0]).join(', ')}`);

  const keys = set.map(([k]) => k), vals = set.map(([, v]) => v);
  keys.push('Attribute Count');
  vals.push(String(keys.length - 1));   // counts every trait before it, as the rest of the collection does

  const png = fs.readFileSync(`${SRC}/images/${i + 1}.png`);
  uris[id] = 'data:image/png;base64,' + png.toString('base64');
  traits[id] = { keys, vals };
  report.push({ id, src: i + 1, tone: tone.v, popSkin: row['skin color'], n: keys.length });
}

fs.writeFileSync(`${OUT}/dataURIs-27turtles.json`, JSON.stringify(uris, null, 2));
fs.writeFileSync(`${OUT}/setTraits-27turtles.json`, JSON.stringify(traits, null, 2));

// Master-collection form too: our index and our name, not "Pop Turtle #1" at index 1.
// The contract builds "QuantumPhunk #<id>" itself, so this is for the off-chain JSON.
const master = {
  name: 'CryptoPhunksV67',
  total_supply: 10000,
  collection_items: report.map((r) => ({
    id: '',
    index: r.id,
    sha: '',
    name: `QuantumPhunk #${r.id}`,
    description: '',
    image: `images/${r.id}.png`,
    attributes: traits[r.id].keys.map((k, n) => ({ trait_type: k, value: traits[r.id].vals[n] })),
  })),
};
fs.writeFileSync(`${OUT}/master-27turtles.json`, JSON.stringify(master, null, 2));

console.log('slot   img   Skin Tone (ours)                 was (pop palette)   traits');
for (const r of report) {
  console.log(`  #${String(r.id).padEnd(5)} ${String(r.src).padStart(2)}    ${r.tone.padEnd(32)} ${String(r.popSkin).padEnd(18)} ${r.n}`);
}
const lens = Object.values(uris).map((u) => u.length);
console.log(`\n27 images, avg ${Math.round(lens.reduce((a, b) => a + b, 0) / 27)} chars, largest ${Math.max(...lens)}`);
console.log(`all carry Animal=Turtle: ${Object.values(traits).every((t) => t.keys.includes('Animal') && t.vals[t.keys.indexOf('Animal')] === 'Turtle')}`);
console.log(`Attribute Count last:    ${Object.values(traits).every((t) => t.keys[t.keys.length - 1] === 'Attribute Count')}`);
console.log(`\nwrote ${OUT}/dataURIs-27turtles.json and ${OUT}/setTraits-27turtles.json`);
