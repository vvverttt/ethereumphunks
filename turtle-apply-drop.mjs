// Apply the 12-token drop to the staged payload.
//
// Writes NEW files rather than editing the originals in place, so the 1,066 payload stays
// on disk untouched and the drop is reversible by pointing the writer back at it.
import fs from 'fs';

const OUT = './v67_new1066';
const drop = JSON.parse(fs.readFileSync(`${OUT}/turtle-drop-12.json`, 'utf8'));
const DROP = new Set(drop.drop.map((d) => String(d.tokenId)));

const uris = JSON.parse(fs.readFileSync(`${OUT}/dataURIs.json`, 'utf8'));
const traits = JSON.parse(fs.readFileSync(`${OUT}/setTraits.json`, 'utf8'));

const before = { uris: Object.keys(uris).length, traits: Object.keys(traits).length };
for (const id of DROP) {
  if (!(id in uris)) throw new Error(`#${id} is not in dataURIs.json — refusing to write a partial drop`);
  if (!(id in traits)) throw new Error(`#${id} is not in setTraits.json — refusing to write a partial drop`);
}

const keptUris = Object.fromEntries(Object.entries(uris).filter(([id]) => !DROP.has(id)));
const keptTraits = Object.fromEntries(Object.entries(traits).filter(([id]) => !DROP.has(id)));

const n = Object.keys(keptUris).length;
if (n !== before.uris - DROP.size) throw new Error('image drop count wrong');
if (Object.keys(keptTraits).length !== n) throw new Error('images and traits disagree after the drop');
if (n !== 1054) throw new Error(`expected 1,054 after the drop, got ${n}`);

fs.writeFileSync(`${OUT}/dataURIs-1054.json`, JSON.stringify(keptUris));
fs.writeFileSync(`${OUT}/setTraits-1054.json`, JSON.stringify(keptTraits));

console.log(`dropped ${DROP.size}:  ${[...DROP].map(Number).sort((a, b) => a - b).join(', ')}`);
console.log(`  images  ${before.uris} -> ${n}`);
console.log(`  traits  ${before.traits} -> ${Object.keys(keptTraits).length}`);

// The dropped ids must now be free, and must be exactly the turtle slots minus the blanks.
const slots = new Set(drop.turtleSlots.map(String));
const blanks = new Set(drop.blanks.map(String));
for (const id of DROP) {
  if (!slots.has(id)) throw new Error(`#${id} was dropped but is not a turtle slot`);
  if (id in keptUris || id in keptTraits) throw new Error(`#${id} survived the drop`);
}
const fromDrop = [...slots].filter((s) => !blanks.has(s));
if (fromDrop.length !== DROP.size) throw new Error('turtle slots do not reconcile with the drop list');

console.log(`\nturtle slots now free: ${drop.turtleSlots.length} (${DROP.size} dropped + ${blanks.size} never assigned)`);
console.log(`payload to write: ${n} non-turtle + ${drop.turtleSlots.length} turtle = ${n + drop.turtleSlots.length}`);
console.log(`live 8,919 + ${n + drop.turtleSlots.length} = ${8919 + n + drop.turtleSlots.length}`);
console.log(`\nwrote ${OUT}/dataURIs-1054.json and ${OUT}/setTraits-1054.json`);
