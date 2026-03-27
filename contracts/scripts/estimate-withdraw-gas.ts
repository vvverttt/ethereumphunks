import hre from 'hardhat';
import * as fs from 'fs';

const LOTTERY1 = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';
const LOTTERY2 = '0x298771ecc338de242ada11e49e2b8224c33bf620';
const CONTRACTS_FILE = 'C:/Users/alber/OneDrive/Desktop/market/v67-in-lottery-contracts.txt';
const BATCH_SIZE = 200;
const L1_START = 2000;
const L1_END = 2500;
const L2_START = 0;
const L2_END = 250;

function parseHashIds(file: string, label: string): string[] {
  const content = fs.readFileSync(file, 'utf8');
  const section = content.slice(content.indexOf(`--- ${label} FULL LIST`));
  const lines = section.split('\n').slice(1);
  const hashIds: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('===') || t.startsWith('---')) break;
    const parts = t.split('|');
    if (parts.length >= 2 && parts[1].trim().startsWith('0x')) hashIds.push(parts[1].trim());
  }
  return hashIds;
}

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log('Wallet balance:', hre.ethers.formatEther(balance), 'ETH');

  const feeData = await hre.ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice!;
  console.log('Gas price:', hre.ethers.formatUnits(gasPrice, 'gwei'), 'gwei\n');

  const l1Hashes = parseHashIds(CONTRACTS_FILE, 'LOTTERY 1').slice(L1_START, L1_END);
  const l2Hashes = parseHashIds(CONTRACTS_FILE, 'LOTTERY 2').slice(L2_START, L2_END);

  const lottery1 = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY1, signer);
  const lottery2 = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY2, signer);

  const batch1 = l1Hashes.slice(0, Math.min(BATCH_SIZE, l1Hashes.length));
  const batch2 = l2Hashes.slice(0, Math.min(BATCH_SIZE, l2Hashes.length));

  const gas1 = await lottery1.withdrawPrizeBatch.estimateGas(batch1);
  const gas2 = await lottery2.withdrawPrizeBatch.estimateGas(batch2);

  const cost1 = hre.ethers.formatEther(gas1 * gasPrice);
  const cost2 = hre.ethers.formatEther(gas2 * gasPrice);
  console.log(`Lottery1 batch (${batch1.length} items): ${gas1.toLocaleString()} gas = ${cost1} ETH`);
  console.log(`Lottery2 batch (${batch2.length} items): ${gas2.toLocaleString()} gas = ${cost2} ETH`);

  const batches1 = Math.ceil(l1Hashes.length / BATCH_SIZE);
  const batches2 = Math.ceil(l2Hashes.length / BATCH_SIZE);
  const totalCostWei = (gas1 * BigInt(batches1)) + (gas2 * BigInt(batches2));
  const totalEth = hre.ethers.formatEther(totalCostWei * gasPrice);

  console.log(`\nRemaining: ${l1Hashes.length} Lottery1 (${batches1} batches) + ${l2Hashes.length} Lottery2 (${batches2} batches)`);
  console.log(`Estimated total ETH needed: ~${totalEth} ETH`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
