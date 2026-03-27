/**
 * 56-withdraw-l2-filtered.ts
 *
 * Withdraws only the L2 hashIds that are actually in the Lottery2 pool
 * (250 out of 263 — 13 are not in pool and are skipped).
 */

import hre from 'hardhat';
import * as fs from 'fs';

const LOTTERY2 = '0x298771ecc338de242ada11e49e2b8224c33bf620';
const CONTRACTS_FILE = 'C:/Users/alber/OneDrive/Desktop/market/v67-in-lottery-contracts.txt';
const BATCH_SIZE = 300;

function parseL2HashIds(file: string): string[] {
  const content = fs.readFileSync(file, 'utf8');
  const idx = content.indexOf('--- LOTTERY 2 FULL LIST');
  if (idx === -1) throw new Error('Section not found: LOTTERY 2 FULL LIST');
  const section = content.slice(idx);
  const lines = section.split('\n').slice(1);
  const hashIds: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('===') || trimmed.startsWith('---')) break;
    const parts = trimmed.split('|');
    if (parts.length >= 2) {
      const hash = parts[1].trim();
      if (hash.startsWith('0x')) hashIds.push(hash);
    }
  }
  return hashIds;
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log('Signer:', signer.address);
  console.log('Balance:', hre.ethers.formatEther(balance), 'ETH\n');

  const contract = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY2, signer);

  const poolSize = await contract.poolSize();
  console.log('L2 pool size:', poolSize.toString());

  const poolItems: string[] = await contract.getPoolItems(0, poolSize);
  const poolSet = new Set(poolItems.map((h: string) => h.toLowerCase()));

  const fileHashIds = parseL2HashIds(CONTRACTS_FILE);
  const toWithdraw = fileHashIds.filter(h => poolSet.has(h.toLowerCase()));
  const skipped = fileHashIds.length - toWithdraw.length;
  console.log(`File L2 count: ${fileHashIds.length}, in pool: ${toWithdraw.length}, skipping: ${skipped}\n`);

  for (let i = 0; i < toWithdraw.length; i += BATCH_SIZE) {
    const batch = toWithdraw.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toWithdraw.length / BATCH_SIZE);

    const gas = await contract.withdrawPrizeBatch.estimateGas(batch);
    const feeData = await hre.ethers.provider.getFeeData();
    console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} items): est gas ${gas.toLocaleString()} = ${hre.ethers.formatEther(gas * feeData.gasPrice!)} ETH`);

    const tx = await contract.withdrawPrizeBatch(batch);
    console.log(`  tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  ✅ confirmed block ${receipt?.blockNumber}`);
  }

  const finalPool = await contract.poolSize();
  console.log(`\nFinal L2 pool size: ${finalPool}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
