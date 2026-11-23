// Builds the Phunksmas manifest from a folder of PNGs. Token id = 10453 + drop-order position (10454..10520),
// continuing right after Phunklloween (10387..10453).
const FIRST_ID = 10454;
//   node scripts/build-phunksmas.js "<images dir>" [preview.html]
// Writes scripts/generated/phunksmas_items.json (image = exact data URI to store on-chain, traits)
// and, if a second arg is given, a local preview page.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// The user's drop order (2026-11-22). [name, origin]
const ORDER = [
  ["Santa Claus"], ["Jingle", "The Year Without a Santa Claus (1974)"], ["Kevin McCallister", "Home Alone (1990)"],
  ["Cindy Lou Who", "How the Grinch Stole Christmas! (1966)"], ["Hero Boy", "The Polar Express (2004)"], ["Gizmo", "Gremlins (1984)"],
  ["Ghost of Christmas Past", "A Christmas Carol (2009)"], ["Snow Miser", "The Year Without a Santa Claus (1974)"],
  ["Bernard", "The Santa Clause (1994)"], ["Sam the Snowman", "Rudolph the Red-Nosed Reindeer (1964)"],
  ["The Nutcracker", "The Nutcracker and the Mouse King (1816)"], ["Jangle", "The Year Without a Santa Claus (1974)"],
  ["Buddy the Elf", "Elf (2003)"], ["Perchta", "Alpine folklore"], ["Ebenezer Scrooge", "A Christmas Carol (2009)"],
  ["Hermey the Elf", "Rudolph the Red-Nosed Reindeer (1964)"], ["Harry", "Home Alone (1990)"],
  ["Zero", "The Nightmare Before Christmas (1993)"], ["Stripe", "Gremlins (1984)"], ["Frosty the Snowman", "Frosty the Snowman (1969)"],
  ["Heat Miser", "The Year Without a Santa Claus (1974)"], ["Mrs. Claus"],
  // (2/3)
  ["The Grinch", "How the Grinch Stole Christmas! (1966)"], ["Linus van Pelt", "Peanuts (1952)"],
  ["Belsnickel", "Palatine German folklore"], ["Robot Santa", "Futurama (1999)"],
  ["King Moonracer", "Rudolph the Red-Nosed Reindeer (1964)"], ["Mari Lwyd", "Welsh folklore"],
  ["Gonzo", "The Muppet Christmas Carol (1992)"], ["Gingerbread Man", "St. Nicholas Magazine (1875)"],
  ["Burgermeister Meisterburger", "Santa Claus Is Comin' to Town (1970)"], ["Old Man Marley", "Home Alone (1990)"],
  ["Rudolph", "Rudolph the Red-Nosed Reindeer (1964)"], ["Rizzo the Rat", "The Muppet Christmas Carol (1992)"],
  ["The Snowman", "The Snowman (1982)"], ["Mother Nature", "The Year Without a Santa Claus (1974)"],
  ["Ghost of Christmas Present", "A Christmas Carol (2009)"], ["Abominable Snow Monster", "Rudolph the Red-Nosed Reindeer (1964)"],
  ["Père Fouettard", "French folklore"], ["Max", "How the Grinch Stole Christmas! (1966)"], ["Charlie Brown", "Peanuts (1950)"],
  ["Marv", "Home Alone (1990)"], ["Jack Frost", "The Santa Clause 3: The Escape Clause (2006)"],
  ["Spotted Elephant", "Rudolph the Red-Nosed Reindeer (1964)"], ["Winter Warlock", "Santa Claus Is Comin' to Town (1970)"],
  // (3/3)
  ["Snoopy", "Peanuts (1950)"], ["Jacob Marley", "A Christmas Carol (2009)"], ["Pigeon Lady", "Home Alone 2: Lost in New York (1992)"],
  ["Yukon Cornelius", "Rudolph the Red-Nosed Reindeer (1964)"], ["The Conductor", "The Polar Express (2004)"],
  ["Mr. Narwhal", "Elf (2003)"], ["Tomte", "Scandinavian folklore"], ["Mouse King", "The Nutcracker and the Mouse King (1816)"],
  ["Clarice", "Rudolph the Red-Nosed Reindeer (1964)"], ["Hocus Pocus", "Frosty the Snowman (1969)"], ["Grýla", "Icelandic folklore"],
  ["Scrooge McDuck", "Christmas on Bear Mountain (1947)"], ["Nestor", "Nestor the Long-Eared Christmas Donkey (1977)"],
  ["Emmet Otter", "Emmet Otter's Jug-Band Christmas (1977)"], ["Mr. Hankey", "South Park (1997)"],
  ["Ghost of Christmas Yet to Come", "A Christmas Carol (2009)"], ["Charlie-in-the-Box", "Rudolph the Red-Nosed Reindeer (1964)"],
  ["The Hobo", "The Polar Express (2004)"], ["Hans Trapp", "Alsatian folklore"], ["Delibird", "Pokémon Gold and Silver (1999)"],
  ["Turbo-Man", "Jingle All the Way (1996)"], ["Krampus", "Alpine folklore"],
];
if (ORDER.length !== 67) throw new Error(`order has ${ORDER.length}, expected 67`);

// Traits follow the Phunklloween system: Type + Character on every piece, then the same keys in the
// same order, reusing Phunklloween spellings where they exist (Horns, Black Top Hat, Rosy Cheeks...).
const KEY_ORDER = ["Head", "Hair", "Eyes", "Ears", "Cheeks", "Nose", "Lips", "Teeth", "Tongue", "Beard", "Face",
  "Mouth", "Neck", "Emotion", "Aura", "Wings", "Item", "Weapon"];
const TRAITS = {
  "Santa Claus":       { Type: ["Male", "Guardian"],     Head: "Santa Hat",       Hair: "White Hair",  Cheeks: "Rosy Cheeks", Beard: ["White Beard", "White Mustache"], Aura: "White Glow" },
  "Jingle":            { Type: "Elf",      Head: "Red Elf Hat",     Hair: "Orange Hair", Cheeks: "Rosy Cheeks", Nose: "Red Nose", Emotion: "Smile" },
  "Kevin McCallister": { Type: "Male",     Head: "Blue Beanie",     Hair: "Blonde Hair", Eyes: "Blue", Neck: "Green Scarf" },
  "Snow Miser":        { Type: "Spirit",   Head: "White Hat",       Hair: "White Hair",  Aura: "White Glow" },
  "Sam the Snowman":   { Type: "Snowman",  Head: "Black Top Hat",   Beard: "White Mustache", Neck: "Green Checkered Vest" },
  "The Nutcracker":    { Type: "Toy",      Head: "Blue Shako",      Hair: "White Hair",  Teeth: "Square Teeth", Neck: "Blue Uniform" },
  "Jangle":            { Type: "Elf",      Head: "Red Elf Hat",     Hair: "Blonde Hair" },
  "Buddy the Elf":     { Type: "Elf",      Head: "Green Elf Hat",   Hair: "Brown Hair",  Eyes: "Blue", Item: "Candy Cane" },
  "Heat Miser":        { Type: "Spirit",   Hair: "Flame Hair",      Nose: "Red Nose",    Emotion: "Grin", Aura: "Orange Glow" },
  "Mrs. Claus":        { Type: ["Female", "Guardian"],   Head: "Holly Santa Hat",       Hair: "White Hair",  Eyes: "Glasses" },
  "The Grinch":        { Type: "Grinch",  Head: "Santa Hat",       Eyes: "Gold",        Emotion: "Grin" },
  "Rudolph":           { Type: "Reindeer", Head: "Antlers",         Nose: "Red Nose",    Emotion: "Smile" },
  "The Snowman":       { Type: "Snowman",  Head: "Green Hat",       Nose: "Carrot Nose", Emotion: "Smile", Aura: "Snowflakes" },
  "Max":               { Type: "Dog",      Head: "Antlers",         Tongue: "Pink Tongue", Emotion: "Smile" },
  "Clarice":           { Type: "Reindeer", Head: "Red Bow",         Emotion: "Smile" },
  "Turbo-Man":         { Type: "Male",     Head: "Turbo Helmet", Aura: "Yellow Glow" },
  "Krampus":           { Type: "Demon",    Head: "Horns",           Eyes: "Red",         Teeth: "Fangs", Beard: "White Beard" },
};

// File names that don't match the list name exactly.
const ALIASES = { buddy: "Buddy the Elf", kevin: "Kevin McCallister", nutcracker: "The Nutcracker", claire: "Clarice", frosty: "Frosty the Snowman" };
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const byNorm = new Map(ORDER.map(([n], i) => [norm(n), i]));

const dir = process.argv[2];
if (!dir) throw new Error("usage: node scripts/build-phunksmas.js <images dir> [preview.html]");
const items = [];
const unmatched = [];
for (const file of fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).sort()) {
  const stem = path.basename(file, path.extname(file)).replace(/_/g, " ");
  const name = ALIASES[norm(stem)] || stem;
  const idx = byNorm.get(norm(name));
  if (idx === undefined) { unmatched.push(file); continue; }
  const buf = fs.readFileSync(path.join(dir, file));
  if (buf.readUInt32BE(16) !== 24 || buf.readUInt32BE(20) !== 24) throw new Error(`${file} is not 24x24`);
  const image = "data:image/png;base64," + buf.toString("base64");
  const [character, origin] = ORDER[idx];
  const t = TRAITS[character];
  if (!t) throw new Error(`no traits drafted for ${character}`);
  // two Types on one piece are allowed (Santa/Mrs. Claus: Male/Female + Guardian), like Phunklloween's Bat and Sparky
  const attributes = [...[].concat(t.Type).map((v) => ({ trait_type: "Type", value: v })), { trait_type: "Character", value: character }];
  // a key may hold several values (Santa: Beard = White Beard + White Mustache), like Phunklloween's double Type
  for (const k of KEY_ORDER) for (const v of [].concat(t[k] || [])) attributes.push({ trait_type: k, value: v });
  items.push({ tokenId: FIRST_ID + idx, position: idx + 1, name: `Phunksmas #${FIRST_ID + idx}`, character, file, bytes: buf.length,
    sha256: crypto.createHash("sha256").update(image).digest("hex"), attributes, image });
}
if (unmatched.length) throw new Error("no slot for: " + unmatched.join(", "));
items.sort((a, b) => a.tokenId - b.tokenId);
const dup = items.find((it, i) => i && items[i - 1].tokenId === it.tokenId);
if (dup) throw new Error(`two files map to #${dup.tokenId} ${dup.character}`);

const out = path.join(__dirname, "generated", "phunksmas_items.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
const manifest = { collection: "Phunksmas", singleName: "Phunksmas", maxSupply: 67, backgroundColor: "638596",
  count: items.length, order: ORDER.map(([character, origin], i) => ({ tokenId: FIRST_ID + i, position: i + 1, character, origin: origin || null })), items };
fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log(`${items.length}/67 -> ${out}`);
for (const it of items) console.log(`  #${String(it.tokenId).padStart(5)} ${it.character.padEnd(28)} ${it.file}`);

const htmlOut = process.argv[3];
if (htmlOut) {
  const have = new Map(items.map((i) => [i.tokenId, i]));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const slots = ORDER.map(([n, o], i) => {
    const it = have.get(FIRST_ID + i);
    return `<div class="slot ${it ? "on" : ""}" title="#${FIRST_ID + i} ${esc(n)}">${it ? `<img src="${it.image}">` : `<span>${FIRST_ID + i}</span>`}</div>`;
  }).join("");
  const cards = items.map((it) => `<article><div class="art"><img src="${it.image}"></div>
    <h3>#${it.tokenId} ${esc(it.character)}</h3><p class="file">${esc(it.file)} · ${it.bytes} B</p>
    <ul>${it.attributes.map((a) => `<li><b>${esc(a.trait_type)}</b> ${esc(a.value)}</li>`).join("")}</ul></article>`).join("");
  const json = esc(JSON.stringify({ ...manifest, items: manifest.items.map(({ image, ...r }) => ({ ...r, image: image.slice(0, 40) + "…" })) }, null, 2));
  fs.writeFileSync(htmlOut, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Phunksmas Review</title><style>
:root{--bg:#0e1a12;--fg:#f3efe6;--mut:#9fb3a5;--card:#16261b;--line:#26402d;--red:#d6453d;--blue:#638596}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif;padding:24px 16px}
h1{margin:0 0 4px;color:var(--red);letter-spacing:.02em}.sub{color:var(--mut);margin:0 0 20px}
h2{font-size:15px;color:var(--mut);text-transform:uppercase;letter-spacing:.08em;margin:28px 0 10px}
.map{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:4px;max-width:900px}
.slot{aspect-ratio:1;background:var(--card);border:1px solid var(--line);display:grid;place-items:center;color:var(--mut);font-size:11px}
.slot.on{background:var(--blue);border-color:var(--blue)}.slot img,.art img{width:100%;image-rendering:pixelated}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
article{background:var(--card);border:1px solid var(--line);padding:10px}.art{background:var(--blue)}
h3{margin:8px 0 2px;font-size:15px}.file{margin:0 0 6px;color:var(--mut);font-size:12px}
ul{margin:0;padding:0;list-style:none;font-size:12px}li b{color:var(--mut);font-weight:600;margin-right:4px}
pre{background:var(--card);border:1px solid var(--line);padding:12px;overflow:auto;max-height:480px;font-size:12px}
</style></head><body><h1>Phunksmas</h1><p class="sub">${items.length} of 67 in · token ids 10454–10520 (after Phunklloween) · background #638596</p>
<h2>67-slot map</h2><div class="map">${slots}</div><h2>Pieces</h2><div class="grid">${cards}</div>
<h2>Manifest JSON (image data URIs truncated here, full in phunksmas_items.json)</h2><pre>${json}</pre></body></html>`);
  console.log("preview ->", htmlOut);
}
