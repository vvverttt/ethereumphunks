import hre from 'hardhat';

const LOTTERY1 = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';
const LOTTERY2 = '0x298771ecc338de242ada11e49e2b8224c33bf620';

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = (process.env.SUPABASE_KEY || '');

async function checkPool(contract: any, label: string) {
  const poolSize = await contract.poolSize();
  console.log(`\n${label} pool size: ${poolSize}`);
  const items: string[] = await contract.getPoolItems(0, poolSize);

  // Batch fetch from Supabase in chunks of 500
  let found = 0, missing = 0;
  const slugCount: Record<string, number> = {};

  for (let i = 0; i < items.length; i += 500) {
    const chunk = items.slice(i, i + 500);
    const ids = chunk.map(h => `"${h.toLowerCase()}"`).join(',');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/ethscriptions?hashId=in.(${ids})&select=hashId,slug,tokenId`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const rows: any[] = await res.json();
    found += rows.length;
    missing += chunk.length - rows.length;
    for (const r of rows) {
      slugCount[r.slug] = (slugCount[r.slug] || 0) + 1;
    }
  }

  console.log(`  Found in DB: ${found}, NOT in DB: ${missing}`);
  console.log('  By slug:', JSON.stringify(slugCount, null, 2));
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const lottery1 = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY1, signer);
  const lottery2 = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY2, signer);
  await checkPool(lottery1, 'Lottery1 (standard)');
  await checkPool(lottery2, 'Lottery2 (premium)');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
