import hre from 'hardhat';
import { createClient } from '@supabase/supabase-js';

const PROXY = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';
const sb = (createClient as any)(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function main() {
  const contract = await hre.ethers.getContractAt('Mutation', PROXY);
  const pairCount = await contract.pairCount();
  console.log(`Total pairs registered: ${pairCount}`);

  // Check each pair - get ogHashId, quantumHashId, registered status, depositor
  let depositedCount = 0;
  const slugCounts: Record<string, number> = {};

  // Get all slugs from DB for reference
  const { data: ethscriptions } = await sb
    .from('ethscriptions')
    .select('hashId, slug, tokenId')
    .in('slug', ['quantumdystophunkzv67', 'quantummissingphunksv67', 'og-dysto-phunks', 'og-missing-phunks']);

  const hashToSlug: Record<string, string> = {};
  const hashToTokenId: Record<string, number> = {};
  for (const row of (ethscriptions || [])) {
    hashToSlug[row.hashId] = row.slug;
    hashToTokenId[row.hashId] = row.tokenId;
  }

  const ZERO = '0x0000000000000000000000000000000000000000';
  const issues: string[] = [];

  for (let pid = 0; pid < Number(pairCount); pid++) {
    const ogHash = await contract.ogHashId(pid);
    const qHash = await contract.quantumHashId(pid);
    const qReg = await contract.registered(qHash);
    const qDep = await contract.depositor(qHash);
    const oDep = await contract.depositor(ogHash);

    const slug = hashToSlug[qHash] || 'unknown';
    const tokenId = hashToTokenId[qHash] || '?';

    slugCounts[slug] = (slugCounts[slug] || 0) + 1;

    if (qDep !== ZERO) depositedCount++;

    if (!qReg) issues.push(`pid=${pid} quantum NOT registered`);
  }

  console.log('\nPair counts by quantum slug:');
  for (const [slug, count] of Object.entries(slugCounts)) {
    console.log(`  ${slug}: ${count}`);
  }

  console.log(`\nQuantum tokens currently deposited: ${depositedCount}/${pairCount}`);
  if (issues.length) {
    console.log('\nIssues:');
    for (const issue of issues) console.log(' ', issue);
  } else {
    console.log('No issues found ✅');
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
