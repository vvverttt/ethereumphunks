import hre from 'hardhat';

const proxyAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.BxG4LrAQOckVGBtAMtPUP4qnEpN-ZvTdRy53LEzbWyY';

async function query(table: string, params: Record<string, string>) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
}

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', proxyAddress);

  // Fetch all OG Missing + OG Dysto hashIds from Supabase
  const slugs = ['og-missing-phunks', 'og-dysto-phunks'];
  const allHashIds: string[] = [];

  for (const slug of slugs) {
    const items = await query('ethscriptions', {
      select: 'hashId',
      slug: `eq.${slug}`,
      limit: '10000',
    });
    console.log(`${slug}: ${items.length} items`);
    for (const item of items) {
      allHashIds.push(item.hashId);
    }
  }

  console.log(`\nTotal eligible hashIds: ${allHashIds.length}`);

  // Set in batches of 50 to avoid gas limits
  const batchSize = 50;
  for (let i = 0; i < allHashIds.length; i += batchSize) {
    const batch = allHashIds.slice(i, i + batchSize);
    console.log(`Setting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allHashIds.length / batchSize)} (${batch.length} items)...`);
    const tx = await contract.setEligibleEthscriptionsBatch(batch, true);
    await tx.wait();
    console.log(`  TX: ${tx.hash}`);
  }

  // Verify a few
  console.log('\nVerifying...');
  const first = await contract.eligibleEthscription(allHashIds[0]);
  const last = await contract.eligibleEthscription(allHashIds[allHashIds.length - 1]);
  const fake = await contract.eligibleEthscription('0x' + '00'.repeat(32));
  console.log(`  First (${allHashIds[0].slice(0, 10)}...): ${first}`);
  console.log(`  Last  (${allHashIds[allHashIds.length - 1].slice(0, 10)}...): ${last}`);
  console.log(`  Fake:  ${fake}`);

  console.log(`\nDone. ${allHashIds.length} eligible ethscriptions set.`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
