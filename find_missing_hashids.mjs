import { readFileSync } from 'fs';

const LOTTERY = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';

const poolHashIds = readFileSync('./lottery_pool_hashids.txt', 'utf8')
  .trim().split('\n').map(h => h.trim().toLowerCase());
console.log(`Pool size: ${poolHashIds.length}`);

// Check ownership of a single hashId
async function checkOwner(hashId) {
  const res = await fetch(`https://api.ethscriptions.com/api/ethscriptions/${hashId}`);
  if (res.status === 404) return { hashId, owner: 'NOT_FOUND' };
  if (!res.ok) return { hashId, owner: `ERR_${res.status}` };
  const data = await res.json();
  const owner = (data.current_owner ?? data.owner ?? '').toLowerCase();
  return { hashId, owner };
}

// Process in parallel batches with rate limit
const BATCH = 10;
const DELAY = 200;
const missing = [];
let done = 0;

for (let i = 0; i < poolHashIds.length; i += BATCH) {
  const batch = poolHashIds.slice(i, i + BATCH);
  const results = await Promise.all(batch.map(checkOwner));
  for (const { hashId, owner } of results) {
    if (owner !== LOTTERY) {
      missing.push({ hashId, owner });
      console.log(`MISSING: ${hashId} — owner: ${owner}`);
    }
  }
  done += batch.length;
  if (done % 100 === 0) process.stdout.write(`\r${done}/${poolHashIds.length}...`);
  await new Promise(r => setTimeout(r, DELAY));
}

console.log(`\n\nDone. Missing from lottery ownership (${missing.length}):`);
for (const { hashId, owner } of missing) {
  console.log(`  ${hashId}  (owner: ${owner})`);
}
