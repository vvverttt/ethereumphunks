import { readFileSync } from 'fs';

const a = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/1 - CryptoPhunksV67.json', 'utf8'));
const b = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/og before 8 or 3 edit/1 - CryptoPhunksV67.json', 'utf8'));

console.log('Main items:', a.collection_items.length);
console.log('Backup items:', b.collection_items.length);

// Check the 3 SHA-fixed items
console.log('\n-- SHA check (#1569, #2103, #3719) --');
const correctShas = {
  1569: 'a74c6c32160d810e40f64535b0512c33a061c737ac40d0ed02f5fc12e150fb0c',
  2103: '0b4b796f20af242a1170dd679ef03fc658d707a495bcac65d904b858ca7e69ff',
  3719: 'd7c7043710f6f1ecbd43db0d770f659a57d3378fabdbb1fab5736491b7c0ee98',
};
for (const [id, correctSha] of Object.entries(correctShas)) {
  const ai = a.collection_items.find(x => x.index === +id);
  const bi = b.collection_items.find(x => x.index === +id);
  console.log(`#${id} main sha:   ${ai?.sha} ${ai?.sha === correctSha ? '✓ correct' : '✗ wrong'}`);
  console.log(`#${id} backup sha: ${bi?.sha} ${bi?.sha === correctSha ? '✓ correct' : '✗ wrong'}`);
}

// Check 8 re-ethscribe items — main should have OLD ids
console.log('\n-- HashId check for 8 items --');
const oldIds = {
  1569: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d',
  2103: '0x1ed45d8d35d5b5f95b3bf2e97a1c5563d665b4653ba295f0961fefb4b84e7ae3',
  3080: '0xee0cfcae35f9f839d93b21fa815b310a660b458eb1029f5a4cdc6ccd0b5bd8eb',
  3719: '0x76e22f2334637a18a94c48e4be78cd23e0c938ea37e9de7bab3848e1a8a3a03d',
  8663: '0xaf3227fa491fbbf0eb4adc1b9078fcca3ea8f2f79916f98822c89d6f702861cd',
  8699: '0x554205831931235cbee89cfc56facf1f32e9128674a522b9e2d4a6c7d9507919',
  9360: '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0',
  9363: '0xf8f8b15a6b2aebbd8cea5348c75a921ed19846aa1f31b3667b3993866ebdc573',
};
for (const [id, oldId] of Object.entries(oldIds)) {
  const ai = a.collection_items.find(x => x.index === +id);
  const bi = b.collection_items.find(x => x.index === +id);
  const mainOk = ai?.id?.toLowerCase() === oldId.toLowerCase();
  const backupOk = bi?.id?.toLowerCase() === oldId.toLowerCase();
  console.log(`#${id} main: ${mainOk ? '✓ old id' : '✗ ' + ai?.id?.slice(0,20)} | backup: ${backupOk ? '✓ old id' : '✗ ' + bi?.id?.slice(0,20)}`);
}
