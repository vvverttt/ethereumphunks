import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

// These items were withdrawn from the lottery pool back to owner
// (they are protocol-invalid duplicates so they can't be re-deposited usefully)
const LOTTERY = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';
const OWNER = '0xea04f65f9dc5917302532859d80fcf36a15de266';

const items = [
  { hashId: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d', tokenId: 1569 },
  { hashId: '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0', tokenId: 9360 },
  { hashId: '0x554205831931235cbee89cfc56facf1f32e9128674a522b9e2d4a6c7d9507919', tokenId: 8699 },
];

for (const { hashId, tokenId } of items) {
  const { error } = await sb
    .from('ethscriptions')
    .update({ owner: OWNER })
    .eq('hashId', hashId);
  if (error) {
    console.error(`#${tokenId} ERROR: ${error.message}`);
  } else {
    console.log(`#${tokenId} (${hashId.slice(0,20)}...) → owner set back to ${OWNER}`);
  }
}

console.log('\nDone. Supabase lottery count should now be 1247.');
