import hre from 'hardhat';
import * as fs from 'fs';

const LOTTERY2 = '0x298771ecc338de242ada11e49e2b8224c33bf620';
const CONTRACTS_FILE = 'C:/Users/alber/OneDrive/Desktop/market/v67-in-lottery-contracts.txt';

function parseHashIds(file: string): string[] {
  const content = fs.readFileSync(file, 'utf8');
  const idx = content.indexOf('--- LOTTERY 2 FULL LIST');
  if (idx === -1) throw new Error('Section not found');
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
  const contract = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY2, signer);

  const poolSize = await contract.poolSize();
  console.log('L2 pool size:', poolSize.toString());

  const poolItems = await contract.getPoolItems(0, poolSize);
  const poolSet = new Set(poolItems.map((h: string) => h.toLowerCase()));
  console.log('Pool items fetched:', poolItems.length);

  const fileHashIds = parseHashIds(CONTRACTS_FILE);
  console.log('File L2 hashIds:', fileHashIds.length);

  const inPool = fileHashIds.filter(h => poolSet.has(h.toLowerCase()));
  const notInPool = fileHashIds.filter(h => !poolSet.has(h.toLowerCase()));
  console.log(`\nIn pool: ${inPool.length}`);
  console.log(`Not in pool: ${notInPool.length}`);
  if (notInPool.length > 0 && notInPool.length <= 20) {
    console.log('Not in pool hashIds:', notInPool);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
