import { readFileSync } from 'fs';

// Load backup JSON
const backup = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/og before 8 or 3 edit/1 - CryptoPhunksV67.json', 'utf8'));
const backupItems = backup.collection_items;
const backupMap = new Map(backupItems.map(x => [x.index, x.sha]));

// Load current JSON
const current = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/1 - CryptoPhunksV67.json', 'utf8'));
const currentMap = new Map(current.collection_items.map(x => [x.index, x.sha]));

console.log(`Backup items: ${backupItems.length}`);
console.log(`Current items: ${current.collection_items.length}`);

// Try to find their attr file under different names
const names = ['cryptophunksv67_attributes.json', 'quantumphunks_attributes.json', 'phunks_attributes.json'];
let theirAttr = null;
for (const name of names) {
  const res = await fetch(`https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public/data/${name}`);
  const d = await res.json();
  if (!d.statusCode) { theirAttr = d; console.log(`Found their attr file: ${name} (${Object.keys(d).length} keys)`); break; }
}

if (!theirAttr) {
  console.log('\nCannot find their attr file — comparing backup vs current directly:');
  const diffs = [];
  for (const [tokenId, backupSha] of backupMap) {
    const currentSha = currentMap.get(tokenId);
    if (backupSha !== currentSha) diffs.push({ tokenId, backupSha, currentSha });
  }
  console.log(`SHA differences between backup and current: ${diffs.length}`);
  for (const d of diffs) console.log(`  #${d.tokenId}: backup=${d.backupSha.slice(0,16)} current=${d.currentSha.slice(0,16)}`);
} else {
  const theirShas = new Set(Object.keys(theirAttr));
  const backupShas = new Set(backupItems.map(x => x.sha));
  const currentShas = new Set(current.collection_items.map(x => x.sha));

  const backupMatchesTheirs = [...backupShas].filter(s => theirShas.has(s)).length;
  const currentMatchesTheirs = [...currentShas].filter(s => theirShas.has(s)).length;
  console.log(`\nBackup SHAs matching etherphunks: ${backupMatchesTheirs}/${backupShas.size}`);
  console.log(`Current SHAs matching etherphunks: ${currentMatchesTheirs}/${currentShas.size}`);
}
