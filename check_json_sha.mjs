import { readFileSync } from 'fs';

const raw = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/1 - CryptoPhunksV67.json', 'utf8'));
const items = raw.collection_items;
console.log('Total:', items.length);

const targets = [
  { tokenId: 1569, wrongSha: '2f829031713d4b6253dcefd9eab48bd55ae154430ccf6c279b27d49535b91155', correctSha: 'a74c6c32160d810e40f64535b0512c33a061c737ac40d0ed02f5fc12e150fb0c' },
  { tokenId: 2103, wrongSha: 'dcb130d85be00f8fd735ddafcba1cc83f99ba8dab0fc79c833401827b615c92b', correctSha: '0b4b796f20af242a1170dd679ef03fc658d707a495bcac65d904b858ca7e69ff' },
  { tokenId: 3719, wrongSha: '504cd67bd212720e37e84fc714da78cdcc1e2daf05c1882219d99d22de8dee66', correctSha: 'd7c7043710f6f1ecbd43db0d770f659a57d3378fabdbb1fab5736491b7c0ee98' },
];

for (const { tokenId, wrongSha, correctSha } of targets) {
  const item = items.find(x => x.index === tokenId || x.name === `QuantumPhunk ${tokenId}`);
  if (!item) { console.log(`#${tokenId}: NOT FOUND`); continue; }
  console.log(`\n#${tokenId} (id: ${item.id?.slice(0,20)}...):`);
  console.log(`  JSON sha:     ${item.sha}`);
  console.log(`  wrong (old):  ${wrongSha}`);
  console.log(`  correct:      ${correctSha}`);
  if (item.sha === wrongSha)    console.log('  → JSON had the WRONG sha ← source of bug');
  else if (item.sha === correctSha) console.log('  → JSON had the correct sha');
  else console.log('  → JSON sha differs from both (third value)');
}
