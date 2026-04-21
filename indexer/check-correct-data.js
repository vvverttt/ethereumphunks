/**
 * check-correct-data.js
 *
 * Compares DB ethscriptions records against the authoritative JSON file.
 * Checks: hashId, sha, and flags suspicious owners (unknown addresses).
 *
 * Run: SUPABASE_SERVICE_ROLE=... node check-correct-data.js
 * Fix:  DRY_RUN=0 SUPABASE_SERVICE_ROLE=... node check-correct-data.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const JSON_FILE = 'C:/Users/alber/OneDrive/Desktop/market/cryptophunksv67_updatedcompleteeeeeeeeeeeeee.json';
const DRY_RUN = process.env.DRY_RUN !== '0';

const KNOWN_OK_OWNERS = [
  '0xea04f65f9dc5917302532859d80fcf36a15de266', // dystolabz (your wallet)
  '0x29b0d38112e8e743b63eb463f3351ab0f1e15977', // Lottery1 (prize pool)
  '0x298771ecc338de242ada11e49e2b8224c33bf620', // Lottery2 (prize pool)
  '0xc1fa86b53e8e101c93c570f276bc5177832bd031', // AuctionHouse
];

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Load JSON
  const raw = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  const items = raw.collection_items;
  console.log(`JSON: ${items.length} items\n`);

  // Build lookup map: tokenId -> { hashId, sha }
  const jsonMap = new Map();
  for (const item of items) {
    jsonMap.set(item.index, { hashId: item.id.toLowerCase(), sha: item.sha.toLowerCase() });
  }

  // Fetch all DB records (paginated)
  let dbRows = [], page = 0;
  while (true) {
    const { data, error } = await supabase.from('ethscriptions')
      .select('tokenId, hashId, sha, owner, prevOwner')
      .eq('slug', 'cryptophunksv67')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error('DB error:', error.message); return; }
    if (!data?.length) break;
    dbRows = dbRows.concat(data);
    if (data.length < 1000) break;
    page++;
  }
  console.log(`DB: ${dbRows.length} rows\n`);

  const hashMismatch = [];
  const shaMismatch = [];
  const missingInDB = [];
  const suspiciousOwners = [];

  for (const [tokenId, json] of jsonMap) {
    const db = dbRows.find(r => r.tokenId === tokenId);
    if (!db) { missingInDB.push(tokenId); continue; }

    if (db.hashId.toLowerCase() !== json.hashId) {
      hashMismatch.push({ tokenId, dbHash: db.hashId, jsonHash: json.hashId });
    }
    if (db.sha.toLowerCase() !== json.sha) {
      shaMismatch.push({ tokenId, dbSha: db.sha, jsonSha: json.sha });
    }
  }

  // Find suspicious owners (not in KNOWN_OK_OWNERS)
  for (const row of dbRows) {
    if (!KNOWN_OK_OWNERS.includes(row.owner.toLowerCase())) {
      suspiciousOwners.push({ tokenId: row.tokenId, owner: row.owner, prevOwner: row.prevOwner });
    }
  }

  console.log(`=== Results ===`);
  console.log(`Missing in DB: ${missingInDB.length}`);
  if (missingInDB.length) console.log('  tokenIds:', missingInDB.slice(0,20));

  console.log(`\nHashId mismatches: ${hashMismatch.length}`);
  hashMismatch.forEach(m => console.log(`  #${m.tokenId}: DB=${m.dbHash.slice(0,16)}... JSON=${m.jsonHash.slice(0,16)}...`));

  console.log(`\nSHA mismatches: ${shaMismatch.length}`);
  shaMismatch.forEach(m => console.log(`  #${m.tokenId}: DB=${m.dbSha.slice(0,16)}... JSON=${m.jsonSha.slice(0,16)}...`));

  console.log(`\nTokens owned by non-contract/non-your-wallet addresses: ${suspiciousOwners.length}`);
  suspiciousOwners.forEach(s => console.log(`  #${s.tokenId}: owner=${s.owner} prevOwner=${s.prevOwner}`));

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Re-run with DRY_RUN=0 to apply fixes for sha/hashId mismatches.');
    return;
  }

  // Fix SHA mismatches
  if (shaMismatch.length > 0) {
    console.log('\nFixing SHA mismatches...');
    for (const m of shaMismatch) {
      const { error } = await supabase.from('ethscriptions').update({ sha: m.jsonSha }).eq('tokenId', m.tokenId).eq('slug', 'cryptophunksv67');
      if (error) console.error(`  #${m.tokenId} error:`, error.message);
      else console.log(`  ✅ #${m.tokenId} sha fixed`);
    }
  }

  // Fix hashId mismatches
  if (hashMismatch.length > 0) {
    console.log('\nFixing hashId mismatches...');
    for (const m of hashMismatch) {
      const { error } = await supabase.from('ethscriptions').update({ hashId: m.jsonHash }).eq('tokenId', m.tokenId).eq('slug', 'cryptophunksv67');
      if (error) console.error(`  #${m.tokenId} error:`, error.message);
      else console.log(`  ✅ #${m.tokenId} hashId fixed`);
    }
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
