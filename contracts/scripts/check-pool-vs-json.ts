import hre from 'hardhat';
import * as fs from 'fs';

const LOTTERY1 = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';
const LOTTERY2 = '0x298771ecc338de242ada11e49e2b8224c33bf620';
const JSON_FILE = 'C:/Users/alber/OneDrive/Desktop/market/cryptophunksv67_updatedcompleteeeeeeeeeeeeee.json';
const PAGE = 100n;

async function getPoolItems(contract: any): Promise<string[]> {
  const poolSize: bigint = await contract.poolSize();
  const items: string[] = [];
  for (let i = 0n; i < poolSize; i += PAGE) {
    const chunk: string[] = await contract.getPoolItems(i, i + PAGE > poolSize ? poolSize - i : PAGE);
    items.push(...chunk);
  }
  return items;
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  const jsonHashIds = new Set(raw.collection_items.map((item: any) => item.id.toLowerCase()));
  console.log(`JSON has ${jsonHashIds.size} valid hashIds\n`);

  const [signer] = await hre.ethers.getSigners();
  const l1 = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY1, signer);
  const l2 = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY2, signer);

  for (const [label, contract] of [['Lottery1', l1], ['Lottery2', l2]] as const) {
    const items = await getPoolItems(contract);
    const invalid = items.filter(h => !jsonHashIds.has(h.toLowerCase()));
    console.log(`${label}: ${items.length} pool items, ${invalid.length} NOT in JSON`);
    if (invalid.length > 0) {
      console.log('  Invalid hashIds:');
      invalid.forEach(h => console.log('  ', h));
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
