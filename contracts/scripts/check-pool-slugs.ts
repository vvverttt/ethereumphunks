import hre from 'hardhat';
import { createClient } from '@supabase/supabase-js';

const LOTTERY1 = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';
const LOTTERY2 = '0x298771ecc338de242ada11e49e2b8224c33bf620';
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE'] || '';
const PAGE = 100n;

async function checkPool(contract: any, label: string, supabase: any) {
  const poolSize: bigint = await contract.poolSize();
  console.log(`\n${label} pool size: ${poolSize}`);

  const items: string[] = [];
  for (let i = 0n; i < poolSize; i += PAGE) {
    const chunk: string[] = await contract.getPoolItems(i, i + PAGE > poolSize ? poolSize - i : PAGE);
    items.push(...chunk);
  }
  console.log(`  Fetched ${items.length} items`);

  let found = 0, missing = 0;
  const slugCount: Record<string, number> = {};
  for (let i = 0; i < items.length; i += 200) {
    const chunk = items.slice(i, i + 200).map(h => h.toLowerCase());
    const { data } = await supabase.from('ethscriptions').select('hashId, slug').in('hashId', chunk);
    found += (data || []).length;
    missing += chunk.length - (data || []).length;
    for (const r of (data || [])) slugCount[r.slug] = (slugCount[r.slug] || 0) + 1;
  }
  console.log(`  In DB: ${found} | NOT in DB (old/invalid): ${missing}`);
  console.log('  By slug:', JSON.stringify(slugCount));
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const [signer] = await hre.ethers.getSigners();
  const l1 = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY1, signer);
  const l2 = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY2, signer);
  await checkPool(l1, 'Lottery1 (standard)', supabase);
  await checkPool(l2, 'Lottery2 (premium)', supabase);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
