// Free up 27 slots for turtles by DROPPING pieces from the 1,066, instead of redrawing 12
// of them as turtles.
//
// The slot count is fixed and decides everything:
//
//   1..10000 minus the 8,919 live          = 1,081 slots left to fill
//   turtles needed (4,267 - 4,240)         =    27
//   so non-turtle entries that may ship    = 1,054
//   staged non-turtle entries today        = 1,066
//   -> drop 12
//
// Dropping 12 leaves 12 empty ids, and 15 ids were never assigned anything, so the
// turtle artist gets 27 free slots and NO constraint from an existing trait set.
//
// Which 12 to drop: the most ordinary pieces in the whole batch — this plan is not
// limited to Lemur/Penguin the way the redraw plan was, because nothing is being kept.
// Ties break toward over-represented animals and toward ids that spread the 27 turtles
// evenly across the collection.
//
// Read-only. Writes the drop list and the turtle slot list; changes no payload.
import fs from 'fs';
import path from 'path';

const SRC = 'C:/Users/alber/OneDrive/Desktop/New folder (12)/final-experiment/_new-1066';
const HOST = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const OUT = './v67_new1066';

const SCARCE = new Set(['Alien', 'Ape', 'Zombie', 'Robot', 'Madlad']);
const PRECIOUS = /gradient|gold|diamond|silver|rainbow|holo|prism|chrome|platinum|rose gold/i;

const LIVE = 8919, LIVE_TURTLES = 4240, TARGET = 10000, TARGET_TURTLES = 4267;

const master = JSON.parse(fs.readFileSync(path.join(SRC, 'new-1066.json'), 'utf8'));
const byId = new Map(master.tokens.map((t) => [t.tokenId, t]));
const batchIds = master.tokens.map((t) => t.tokenId).sort((a, b) => a - b);
const blanks = JSON.parse(fs.readFileSync(`${OUT}/turtle-new-ids.json`, 'utf8'));
const BLANKS = (Array.isArray(blanks) ? blanks : blanks.ids).slice().sort((a, b) => a - b);

const val = (t, k) => t.attributes.find((a) => a.trait_type === k)?.value ?? null;
const animalOf = (id) => val(byId.get(id), 'Animal');

const slots = TARGET - LIVE;
const needTurtles = TARGET_TURTLES - LIVE_TURTLES;
const mayShip = slots - needTurtles;
const DROP = batchIds.length - mayShip;

console.log('slot arithmetic');
console.log(`  ids 1..${TARGET} not yet live      ${slots}`);
console.log(`  turtles needed                  ${needTurtles}`);
console.log(`  non-turtle entries that fit     ${mayShip}`);
console.log(`  staged non-turtle entries       ${batchIds.length}`);
console.log(`  -> DROP                         ${DROP}`);
console.log(`  turtle slots afterwards         ${DROP} dropped + ${BLANKS.length} never-assigned = ${DROP + BLANKS.length}\n`);
if (DROP + BLANKS.length !== needTurtles) throw new Error('slot arithmetic does not close');

// Trait frequency across the whole 9,985 so "ordinary" means ordinary collection-wide.
const liveAttrs = await (await fetch(`${HOST}/storage/v1/object/public/data/cryptophunksv67_attributes.json`)).json();
const freq = new Map();
const bump = (k, v) => freq.set(`${k}|${v}`, (freq.get(`${k}|${v}`) || 0) + 1);
for (const list of Object.values(liveAttrs)) for (const a of list || []) bump(a.k, a.v);
for (const t of master.tokens) for (const a of t.attributes) bump(a.trait_type, a.value);

const blockers = (t) => t.attributes.filter((a) => SCARCE.has(String(a.value)) || PRECIOUS.test(String(a.value)));
// Animal counts here: unlike the redraw plan, the piece is being discarded whole.
const rarest = (t) => Math.min(...t.attributes
  .filter((a) => a.trait_type !== 'Attribute Count')
  .map((a) => freq.get(`${a.trait_type}|${a.value}`) || 0));

const animalCount = new Map();
for (const id of batchIds) animalCount.set(animalOf(id), (animalCount.get(animalOf(id)) || 0) + 1);

const clean = batchIds.filter((id) => blockers(byId.get(id)).length === 0);
console.log(`candidates: ${clean.length} of ${batchIds.length} carry nothing scarce or precious`);

const decile = (id) => Math.min(9, Math.floor((id - 1) / 1000));
const want = needTurtles / 10;
const have = new Array(10).fill(0);
for (const b of BLANKS) have[decile(b)]++;

const ranked = clean.map((id) => ({ id, r: rarest(byId.get(id)), a: animalOf(id) })).sort((a, b) => b.r - a.r);

const taken = [];
for (let n = 0; n < DROP; n++) {
  let best = null, bestScore = -Infinity;
  for (const c of ranked) {
    if (taken.some((t) => t.id === c.id)) continue;
    let s = c.r * 10;                                            // commonness dominates
    s += (have[decile(c.id)] < want ? 12 : -6);                  // even turtle spread
    s += (animalCount.get(c.a) || 0) / 20;                       // shave over-represented animals
    if (taken.some((t) => Math.abs(t.id - c.id) < 400)) s -= 15; // never clump the drops
    if (s > bestScore) { bestScore = s; best = c; }
  }
  taken.push(best);
  have[decile(best.id)]++;
}
taken.sort((a, b) => a.id - b.id);

console.log(`\nthe ${DROP} to drop (most ordinary first by rarest trait):`);
for (const t of taken) {
  const tk = byId.get(t.id);
  const tr = tk.attributes.filter((a) => a.trait_type !== 'Attribute Count')
    .map((a) => `${a.value}(${freq.get(`${a.trait_type}|${a.value}`)})`).join(', ');
  console.log(`  #${String(t.id).padEnd(6)} ${String(t.a).padEnd(9)} rarest ${String(t.r).padStart(3)}   ${tr}`);
}

const turtleIds = [...taken.map((t) => t.id), ...BLANKS].sort((a, b) => a - b);
console.log(`\nthe ${turtleIds.length} turtle slots, all free-draw:`);
console.log('  ' + turtleIds.join(', '));

console.log('\nturtle spread by thousand:');
for (let d = 0; d < 10; d++) {
  const n = turtleIds.filter((i) => decile(i) === d).length;
  console.log(`  ${String(d * 1000 + 1).padStart(5)}-${String((d + 1) * 1000).padEnd(5)}  ${'#'.repeat(n)} ${n}`);
}

// What the drop does to the animal mix that was deliberately balanced.
console.log('\nanimals removed from the batch:');
const removed = new Map();
for (const t of taken) removed.set(t.a, (removed.get(t.a) || 0) + 1);
for (const [a, n] of [...removed].sort((x, y) => y[1] - x[1])) {
  console.log(`  ${String(a).padEnd(10)} -${n}   (${animalCount.get(a)} -> ${animalCount.get(a) - n} in batch)`);
}

fs.writeFileSync(`${OUT}/turtle-drop-12.json`, JSON.stringify({
  note: 'drop these from the 1,066; their ids join the 15 never-assigned ids as free-draw turtle slots',
  built_at: new Date().toISOString(),
  arithmetic: { slots, needTurtles, mayShip, staged: batchIds.length, drop: DROP },
  drop: taken.map((t) => ({ tokenId: t.id, animal: t.a, rarestTraitSeen: t.r,
    traits: byId.get(t.id).attributes.map((a) => ({ k: a.trait_type, v: a.value })) })),
  turtleSlots: turtleIds,
  blanks: BLANKS,
}, null, 2));
console.log(`\nwrote ${OUT}/turtle-drop-12.json`);
