import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

// These 6 tokens have wrong sha in ethscriptions — should be hashId without 0x
const fixes = [
  { hashId: '0x08c4e1aac380b9700095caf494f9e2ea21bc3eeb6dcf57f3e0d3061289ec51d5', correctSha: '08c4e1aac380b9700095caf494f9e2ea21bc3eeb6dcf57f3e0d3061289ec51d5', tokenId: 544 },
  { hashId: '0x8f7b8c810281eebf97c497e8409999ff667939f28678f08fb44945cfe7e6663a',  correctSha: '8f7b8c810281eebf97c497e8409999ff667939f28678f08fb44945cfe7e6663a',  tokenId: 1357 },
  { hashId: '0x11c4ff0c96fa5d01b76acf7e6bd193c2d493fe6310ebdcf84670d60d9747ab0d', correctSha: '11c4ff0c96fa5d01b76acf7e6bd193c2d493fe6310ebdcf84670d60d9747ab0d', tokenId: 1848 },
  { hashId: '0xf54c343074c0aadad849f9814a6884920bf50e9b2f47c014b94a7af4946d28cf',  correctSha: 'f54c343074c0aadad849f9814a6884920bf50e9b2f47c014b94a7af4946d28cf',  tokenId: 1970 },
  { hashId: '0x48a5ebaac71ee71f21e42b6752df3bff06ffd7187ccc538816a17133f59b29ca',  correctSha: '48a5ebaac71ee71f21e42b6752df3bff06ffd7187ccc538816a17133f59b29ca',  tokenId: 4847 },
  { hashId: '0xf0d6467c299588176cc1f93d80bec0596e4aaf86f454cd70c8416d8aaba80184',  correctSha: 'f0d6467c299588176cc1f93d80bec0596e4aaf86f454cd70c8416d8aaba80184',  tokenId: 6000 },
];

for (const { hashId, correctSha, tokenId } of fixes) {
  const { error } = await sb
    .from('ethscriptions')
    .update({ sha: correctSha })
    .eq('hashId', hashId);

  if (error) {
    console.error(`FAILED tokenId ${tokenId}:`, error.message);
  } else {
    console.log(`Fixed tokenId ${tokenId}`);
  }
}

// 7th case — tokenId 8162 has hashId 0xa7c4be62... but attrs has sha 2817fd9c...
// These don't match so needs manual investigation
console.log('\nNote: tokenId 8162 (hashId 0xa7c4be62...) sha mismatch needs manual check');
console.log('Done');
