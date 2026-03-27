/**
 * 57-withdraw-invalid-from-l1.ts
 *
 * Finds the ~200 pool items in Lottery1 that are NOT in the DB (old/invalid hashIds)
 * and withdraws them.
 */
import hre from 'hardhat';
import { createClient } from '@supabase/supabase-js';

const LOTTERY1 = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE'] || '';
const PAGE = 100n;
const BATCH_SIZE = 200;

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const [signer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log('Signer:', signer.address, '— Balance:', hre.ethers.formatEther(balance), 'ETH\n');

  const contract = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY1, signer);
  const poolSize: bigint = await contract.poolSize();
  console.log('Pool size:', poolSize.toString());

  // Fetch all pool items
  const items: string[] = [];
  for (let i = 0n; i < poolSize; i += PAGE) {
    const chunk: string[] = await contract.getPoolItems(i, i + PAGE > poolSize ? poolSize - i : PAGE);
    items.push(...chunk);
  }
  console.log('Fetched', items.length, 'items');

  // Find which ones are NOT in DB
  const inDb = new Set<string>();
  for (let i = 0; i < items.length; i += 200) {
    const chunk = items.slice(i, i + 200).map(h => h.toLowerCase());
    const { data } = await supabase.from('ethscriptions').select('hashId').in('hashId', chunk);
    for (const r of (data || [])) inDb.add(r.hashId.toLowerCase());
  }
  const invalid = items.filter(h => !inDb.has(h.toLowerCase()));
  console.log('Invalid (not in DB):', invalid.length);

  if (invalid.length === 0) { console.log('Nothing to withdraw.'); return; }

  // Estimate gas first
  const gas = await contract.withdrawPrizeBatch.estimateGas(invalid.slice(0, Math.min(BATCH_SIZE, invalid.length)));
  const feeData = await hre.ethers.provider.getFeeData();
  const batches = Math.ceil(invalid.length / BATCH_SIZE);
  console.log(`Est gas for first batch: ${gas.toLocaleString()} = ${hre.ethers.formatEther(gas * feeData.gasPrice!)} ETH`);
  console.log(`Total batches needed: ${batches}\n`);

  // Withdraw in batches
  let done = 0;
  for (let i = 0; i < invalid.length; i += BATCH_SIZE) {
    const batch = invalid.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const tx = await contract.withdrawPrizeBatch(batch);
    console.log(`Batch ${batchNum}/${batches} tx: ${tx.hash}`);
    const receipt = await tx.wait();
    done += batch.length;
    console.log(`  ✅ confirmed block ${receipt?.blockNumber}, done ${done}/${invalid.length}`);
  }

  const finalPool = await contract.poolSize();
  console.log(`\nFinal Lottery1 pool size: ${finalPool} (should be ~468)`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
