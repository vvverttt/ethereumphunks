import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

const swaps = [
  { tokenId: 1569, oldHashId: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d', newHashId: '0x2014d4f2f58338256e4f6fe1b6ee8db56c9588e27bedf0b8a92245302960312b' },
  { tokenId: 2103, oldHashId: '0x1ed45d8d35d5b5f95b3bf2e97a1c5563d665b4653ba295f0961fefb4b84e7ae3', newHashId: '0xb4507cb6c1c380f2fbc4f47fe60e7be1a504c517ea2829dc5cc4f96321a6434b' },
  { tokenId: 3080, oldHashId: '0xee0cfcae35f9f839d93b21fa815b310a660b458eb1029f5a4cdc6ccd0b5bd8eb', newHashId: '0x14322d1d1609fc8833168dfacc8f437104b50095afd1ba23b020b982036f6bf3' },
  { tokenId: 3719, oldHashId: '0x76e22f2334637a18a94c48e4be78cd23e0c938ea37e9de7bab3848e1a8a3a03d', newHashId: '0xa44a47170b7f10fab50bc05da31e61ed42fa24e2c94b75ccd7dc72734c530bb4' },
  { tokenId: 8663, oldHashId: '0xaf3227fa491fbbf0eb4adc1b9078fcca3ea8f2f79916f98822c89d6f702861cd', newHashId: '0x27878d1f2d5ce6b87b738bbd4f577719c14ad7c5180f54866bd09a57b430b23a' },
  { tokenId: 8699, oldHashId: '0x554205831931235cbee89cfc56facf1f32e9128674a522b9e2d4a6c7d9507919', newHashId: '0x6d71a5087ee651c46fd15c4f6019f55faf856abdf5ca7fae86b95bac47103e9b' },
  { tokenId: 9360, oldHashId: '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0', newHashId: '0xb9bc129259e882734dfbdb08fec8cf47aad590d369e82a14ad5b076e20de33b2' },
  { tokenId: 9363, oldHashId: '0xf8f8b15a6b2aebbd8cea5348c75a921ed19846aa1f31b3667b3993866ebdc573', newHashId: '0x188d61444f00385333da689bd5b3e8bca394d1c15cb44be67a02e3f59825ed35' },
];

console.log('=== Supabase check ===');
for (const { tokenId, oldHashId, newHashId } of swaps) {
  const { data: newRow } = await sb.from('ethscriptions').select('hashId, tokenId, owner, sha').eq('hashId', newHashId).single();
  const { data: oldRow } = await sb.from('ethscriptions').select('hashId').eq('hashId', oldHashId).single();
  const oldGone = !oldRow;
  const newPresent = !!newRow;
  console.log(`#${tokenId}: new=${newPresent ? '✓' : 'MISSING'} old_gone=${oldGone ? '✓' : 'STILL EXISTS'} owner=${newRow?.owner?.slice(0,14)}...`);
}

console.log('\n=== ethscriptions.com check ===');
for (const { tokenId, newHashId } of swaps) {
  try {
    const res = await fetch(`https://ethscriptions.com/api/ethscriptions/${newHashId}`);
    const status = res.status;
    let indexed = false;
    if (status === 200) {
      const data = await res.json();
      indexed = !!data?.ethscription;
    }
    console.log(`#${tokenId}: HTTP ${status} ${indexed ? '✓ INDEXED' : status === 404 ? '✗ NOT YET' : ''}`);
  } catch(e) {
    console.log(`#${tokenId}: fetch error - ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 300));
}

console.log('\n=== JSON check ===');
const jsonData = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/1 - CryptoPhunksV67.json', 'utf8'));
for (const { tokenId, newHashId, oldHashId } of swaps) {
  const item = jsonData.collection_items.find(x => x.index === tokenId);
  const hasNew = item?.id?.toLowerCase() === newHashId.toLowerCase();
  const hasOld = item?.id?.toLowerCase() === oldHashId.toLowerCase();
  console.log(`#${tokenId}: ${hasNew ? '✓ new hashId' : hasOld ? '✗ still old' : `? ${item?.id?.slice(0,20)}`}`);
}
