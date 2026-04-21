import { readFileSync, writeFileSync } from 'fs';

const path = 'C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/1 - CryptoPhunksV67.json';
const raw = JSON.parse(readFileSync(path, 'utf8'));

const fixes = [
  { tokenId: 1569, correctSha: 'a74c6c32160d810e40f64535b0512c33a061c737ac40d0ed02f5fc12e150fb0c' },
  { tokenId: 2103, correctSha: '0b4b796f20af242a1170dd679ef03fc658d707a495bcac65d904b858ca7e69ff' },
  { tokenId: 3719, correctSha: 'd7c7043710f6f1ecbd43db0d770f659a57d3378fabdbb1fab5736491b7c0ee98' },
];

for (const { tokenId, correctSha } of fixes) {
  const item = raw.collection_items.find(x => x.index === tokenId || x.name === `QuantumPhunk ${tokenId}`);
  if (!item) { console.log(`#${tokenId}: NOT FOUND`); continue; }
  console.log(`#${tokenId}: ${item.sha} → ${correctSha}`);
  item.sha = correctSha;
}

writeFileSync(path, JSON.stringify(raw, null, 2));
console.log('\nJSON updated.');
