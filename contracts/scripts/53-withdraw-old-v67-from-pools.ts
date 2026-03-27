/**
 * 53-withdraw-old-v67-from-pools.ts
 *
 * Withdraws 2820 old v67 hashIds from PhilipLotteryV67 contracts
 *   Lottery1: 0x29b0d38112e8e743b63eb463f3351ab0f1e15977 (2557 tokens)
 *   Lottery2: 0x298771ecc338de242ada11e49e2b8224c33bf620 (263 tokens)
 *
 * Run (dry-run):
 *   npx hardhat run scripts/53-withdraw-old-v67-from-pools.ts --network mainnet
 */

import hre from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

const LOTTERY1 = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';
const LOTTERY2 = '0x298771ecc338de242ada11e49e2b8224c33bf620';
const CONTRACTS_FILE = 'C:/Users/alber/OneDrive/Desktop/market/v67-in-lottery-contracts.txt';
const BATCH_SIZE = 300;
// Update these offsets each run to skip already-withdrawn items
// Done: items 0-1999, 2500-2556 from L1; nothing from L2 yet
const L1_START = 2200;   // items 2000-2199 also done now
const L1_END   = 2500;   // do 300 more from L1
const L2_START = 0;
const L2_END   = 263;    // do all 263 from L2

function parseHashIds(file: string, lotteryLabel: string): string[] {
  const content = fs.readFileSync(file, 'utf8');
  // Find section "--- LOTTERY N FULL LIST (tokenId | oldHashId) ---"
  const label = lotteryLabel === 'LOTTERY 1' ? 'LOTTERY 1 FULL LIST' : 'LOTTERY 2 FULL LIST';
  const idx = content.indexOf(`--- ${label}`);
  if (idx === -1) throw new Error(`Section not found: ${label}`);

  const section = content.slice(idx);
  const lines = section.split('\n').slice(1); // skip header line
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

async function withdrawBatch(
  contract: any,
  hashIds: string[],
  label: string,
): Promise<void> {
  const total = hashIds.length;
  let done = 0;
  let failed = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = hashIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(total / BATCH_SIZE);

    try {
      const tx = await contract.withdrawPrizeBatch(batch);
      console.log(`  [${label}] Batch ${batchNum}/${totalBatches} tx: ${tx.hash}`);
      const receipt = await tx.wait();
      done += batch.length;
      console.log(`    ✅ confirmed (block ${receipt?.blockNumber}), total done: ${done}/${total}`);
    } catch (err: any) {
      console.error(`  ❌ [${label}] Batch ${batchNum} failed: ${err.message}`);
      failed += batch.length;
    }
  }

  console.log(`\n[${label}] Done: ${done} withdrawn, ${failed} failed`);
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Signer:', signer.address);

  const lottery1HashIds = parseHashIds(CONTRACTS_FILE, 'LOTTERY 1').slice(L1_START, L1_END);
  const lottery2HashIds = parseHashIds(CONTRACTS_FILE, 'LOTTERY 2').slice(L2_START, L2_END);

  console.log(`\nLottery1: ${lottery1HashIds.length} hashIds to withdraw (positions ${L1_START}-${L1_END - 1})`);
  console.log(`Lottery2: ${lottery2HashIds.length} hashIds to withdraw (positions ${L2_START}-${L2_END - 1})`);
  console.log(`Batch size: ${BATCH_SIZE}\n`);

  const lottery1 = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY1, signer);
  const lottery2 = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY2, signer);

  // Check pool sizes first
  const pool1Size = await lottery1.poolSize();
  const pool2Size = await lottery2.poolSize();
  console.log(`Lottery1 pool size: ${pool1Size}`);
  console.log(`Lottery2 pool size: ${pool2Size}\n`);

  console.log('=== Withdrawing from Lottery1 ===');
  await withdrawBatch(lottery1, lottery1HashIds, 'Lottery1');

  console.log('\n=== Withdrawing from Lottery2 ===');
  await withdrawBatch(lottery2, lottery2HashIds, 'Lottery2');

  // Check final pool sizes
  const finalPool1 = await lottery1.poolSize();
  const finalPool2 = await lottery2.poolSize();
  console.log(`\nFinal Lottery1 pool size: ${finalPool1}`);
  console.log(`Final Lottery2 pool size: ${finalPool2}`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
