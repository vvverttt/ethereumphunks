import hre from 'hardhat';
import { createClient } from '@supabase/supabase-js';

const PROXY = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';
const sb = (createClient as any)(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function main() {
  const contract = await hre.ethers.getContractAt('Mutation', PROXY);
  const pairCount = Number(await contract.pairCount());

  // Get all quantum ethscriptions from DB
  const { data: quantum } = await sb
    .from('ethscriptions')
    .select('hashId, tokenId, slug, owner')
    .in('slug', ['quantumdystophunkzv67', 'quantummissingphunksv67'])
    .order('tokenId');

  const dbByTokenId: Record<number, any> = {};
  for (const row of (quantum || [])) {
    // May have 2 rows per tokenId (old + new) — prefer the one with latest hashId
    if (!dbByTokenId[row.tokenId] || row.hashId > dbByTokenId[row.tokenId].hashId) {
      dbByTokenId[row.tokenId] = row;
    }
  }

  // Build map of quantum hashId → tokenId from DB
  const dbHashToTokenId: Record<string, number> = {};
  for (const [tid, row] of Object.entries(dbByTokenId)) {
    dbHashToTokenId[(row as any).hashId] = Number(tid);
  }

  console.log(`Checking ${pairCount} pairs...\n`);
  let issues = 0;
  const ZERO = '0x0000000000000000000000000000000000000000';

  for (let pid = 0; pid < pairCount; pid++) {
    const qHash = await contract.quantumHashId(pid);
    const qReg = await contract.registered(qHash);
    const qDep = await contract.depositor(qHash);
    const isOg = await contract.isOg(qHash);

    // Check DB knows this hashId
    const dbTokenId = dbHashToTokenId[qHash];
    const deposited = qDep !== ZERO;

    if (!qReg) {
      console.log(`❌ pid=${pid} qHash=${qHash.slice(0,18)}... NOT REGISTERED`);
      issues++;
    } else if (isOg) {
      console.log(`❌ pid=${pid} qHash=${qHash.slice(0,18)}... marked as OG (wrong!)`);
      issues++;
    } else if (!dbTokenId) {
      console.log(`⚠️  pid=${pid} qHash=${qHash.slice(0,18)}... NOT IN DB`);
      issues++;
    } else {
      // All good
      if (pid < 5 || pid >= pairCount - 5) {
        console.log(`✅ pid=${pid} tokenId=#${dbTokenId} qHash=${qHash.slice(0,18)}... deposited=${deposited}`);
      }
    }
  }

  if (issues === 0) {
    console.log(`\nAll ${pairCount} pairs registered correctly ✅`);
  } else {
    console.log(`\n${issues} issues found`);
  }

  // Show the 23 updated pairs specifically
  const updated = [10004,10015,10058,10078,10093,10099,10207,10250,10251,10259,10261,10277,10287,10290,10293,10295,10298,10299,10301,10306,10307,10308,10312];
  console.log('\n=== 23 updated quantum pairs ===');
  for (const [tid, row] of Object.entries(dbByTokenId)) {
    if (updated.includes(Number(tid))) {
      const pid = Number(await contract.pairIdOf(row.hashId));
      const contractQHash = await contract.quantumHashId(pid);
      const match = contractQHash.toLowerCase() === row.hashId.toLowerCase();
      const dep = await contract.depositor(row.hashId);
      console.log(`#${tid} pid=${pid} match=${match ? '✅' : '❌'} deposited=${dep !== ZERO} dbOwner=${row.owner?.slice(0,10)}...`);
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
