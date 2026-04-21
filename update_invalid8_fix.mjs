import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE);

const mapping = [
  { tokenId: 1569, oldHash: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d', newHash: '0x3402ecf21d817a8e648f1786cd9a65cc04db2bf231b1990f23681e9878d0a2b2', newSha: 'e40a0b379f16dce8923378ec9f7dd08169ce7854bd75b6017ec9bd4c13759e11', block: 24668293 },
  { tokenId: 2103, oldHash: '0x1ed45d8d35d5b5f95b3bf2e97a1c5563d665b4653ba295f0961fefb4b84e7ae3', newHash: '0xce4222491cb09aa238d19f3a71c388a46f2ecc45f04cea4f63ee796029f7ec56', newSha: '4f9f54cab45631a35c7ee067cdd39e945e17771a419e36d5595479eb8895ec5f', block: 24668298 },
  { tokenId: 3080, oldHash: '0xee0cfcae35f9f839d93b21fa815b310a660b458eb1029f5a4cdc6ccd0b5bd8eb', newHash: '0xa1a5a3a32c20d4984026c35db6989745da83909e5b8acb55eb1ad76d38421c2d', newSha: '7eb31cbc563f198857b900fe23d80a3b8f29b41949e993e17b8747025f756048', block: 24668300 },
  { tokenId: 3719, oldHash: '0x76e22f2334637a18a94c48e4be78cd23e0c938ea37e9de7bab3848e1a8a3a03d', newHash: '0xc3b617e29be433bf711ce70f3c0cb534421c0f561f0c81322ce08c62bcd58ffb', newSha: '7c62f9d413e376fc0b2eb9300e2bef33290aa24388ba0a5449b3085683f63924', block: 24668305 },
  { tokenId: 8663, oldHash: '0xaf3227fa491fbbf0eb4adc1b9078fcca3ea8f2f79916f98822c89d6f702861cd', newHash: '0x53083c7f14a5233befb6933a12eeba8012a126ede10a0435358b1befd2c11af4', newSha: '2a5b47386370c7a756ee25b4ca05fb71fa752ea73499cbf5716858f94dcd7465', block: 24668313 },
  { tokenId: 8699, oldHash: '0x554205831931235cbee89cfc56facf1f32e9128674a522b9e2d4a6c7d9507919', newHash: '0x2e232e6a9edab1de6667a09b66a46e3cdceebf6455bd71748dae37793acd69bf', newSha: '298d9330f5d7448853b1f2b40d21ce687df19422795fa2343d0093224d8578a4', block: 24668313 },
  { tokenId: 9360, oldHash: '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0', newHash: '0x85f349d41feaf21d6efe953bf52147598a18a219364f169a4abd730bf6ae4092', newSha: '6f8be3828c449397edc9bd27ed39e287803e671bdc460a685d51aee021d75323', block: 24668313 },
  { tokenId: 9363, oldHash: '0xf8f8b15a6b2aebbd8cea5348c75a921ed19846aa1f31b3667b3993866ebdc573', newHash: '0x091f594cdb17c1a1417e4b3a1c9dce06c7957a558609d87c840318c365da3e44', newSha: '56c257dc77294287cf7d0985fa3d8db5d00d9b2b8fb0a66336ba1e8f90ea6855', block: 24668320 },
];

// First, check what columns exist
const { data: sample } = await sb.from('ethscriptions').select('*').limit(1);
console.log('Table columns:', sample?.[0] ? Object.keys(sample[0]) : 'no data');

console.log('\n=== Updating Supabase ===');
for (const m of mapping) {
  // Delete events first (FK constraint)
  const { error: evErr } = await sb.from('events').delete().eq('hashId', m.oldHash);
  if (evErr) {
    // Try lowercase
    const { error: evErr2 } = await sb.from('events').delete().eq('hashId', m.oldHash.toLowerCase());
    if (evErr2) console.log(`  #${m.tokenId} events err: ${evErr.message}`);
  }

  // Check current row
  const { data: row } = await sb.from('ethscriptions').select('hashId,sha,createdAt').eq('hashId', m.oldHash).single();
  const checkLower = !row;

  const updatePayload = { hashId: m.newHash, sha: m.newSha, createdAt: m.block };

  const { data, error } = await sb
    .from('ethscriptions')
    .update(updatePayload)
    .eq('hashId', checkLower ? m.oldHash.toLowerCase() : m.oldHash)
    .select('hashId,sha');

  if (error) {
    // Try without createdAt
    const { data: d2, error: e2 } = await sb
      .from('ethscriptions')
      .update({ hashId: m.newHash, sha: m.newSha })
      .eq('hashId', checkLower ? m.oldHash.toLowerCase() : m.oldHash)
      .select('hashId,sha');
    if (e2) console.log(`  #${m.tokenId}: error: ${e2.message}`);
    else console.log(`  #${m.tokenId}: updated (no createdAt) rows=${d2?.length} → ${d2?.[0]?.hashId?.slice(0,14)}`);
  } else {
    console.log(`  #${m.tokenId}: updated rows=${data?.length} → ${data?.[0]?.hashId?.slice(0,14)}`);
  }
}

// Verify
console.log('\n=== Verification ===');
for (const m of mapping) {
  const { data } = await sb.from('ethscriptions').select('hashId,sha,tokenId').eq('hashId', m.newHash).single();
  const ok = data?.sha === m.newSha;
  console.log(`  #${m.tokenId}: ${ok ? '✓' : '✗ sha=' + data?.sha?.slice(0,14)}`);
}
console.log('\nDone!');
