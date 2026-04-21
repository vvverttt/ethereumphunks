import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
//  Seed ERC721PhunksV67 — deployer only pays for:
//    1. batchSetAuthorizedTokenId  (bridge protection, ~0.1 ETH)
//    2. setMerkleRoot              (1 tx, dust)
//
//  Everything else (image, label, traits, hashId, sha) is paid by the user
//  at mint time via the merkle proof path.
//
//  Run AFTER upgrading the proxy:
//    npx hardhat run scripts/97-seed-erc721phunks.ts --network mainnet
// ─────────────────────────────────────────────────────────────────────────────

const PROXY      = '0x9833b60234424e1DAAC8883D3F52c16093563BBF';
const DATA_DIR   = path.resolve(__dirname, '../../New folder');
const BATCH_SIZE = 200;

const FILES = [
  '1 - CryptoPhunksV67 (1).json',
  '2 - QuantumMissingPhunksV67 (1).json',
  '3 - QuantumDystoPhunkzV67 (1).json',
];

interface CollectionItem {
  id: string;
  index: number;
  sha: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Seeder :', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH\n');

  const abi = [
    'function batchSetAuthorizedTokenId(bytes32[] hashIds, uint256[] tokenIds) external',
    'function setMerkleRoot(bytes32 root) external',
  ];
  const contract = new ethers.Contract(PROXY, abi, deployer);

  // Load + merge all collections
  const allItems: CollectionItem[] = [];
  for (const file of FILES) {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    allItems.push(...raw.collection_items);
    console.log(`Loaded ${raw.collection_items.length} items from ${file}`);
  }
  console.log(`\nTotal items: ${allItems.length}\n`);

  // ── 1. Authorized tokenIds (bridge protection) ────────────────────────────
  console.log('=== 1/2  Authorized tokenIds ===');
  for (const batch of chunk(allItems, BATCH_SIZE)) {
    const hashIds  = batch.map(i => i.id as `0x${string}`);
    const tokenIds = batch.map(i => i.index);
    const tx = await contract.batchSetAuthorizedTokenId(hashIds, tokenIds);
    await tx.wait();
    process.stdout.write(`  ✓ ${tokenIds[0]}–${tokenIds[tokenIds.length - 1]}\n`);
  }

  // ── 2. Set merkle root (run 98-build-merkle.ts first) ─────────────────────
  const rootFile = path.resolve(__dirname, './merkle-root.txt');
  if (fs.existsSync(rootFile)) {
    const root = fs.readFileSync(rootFile, 'utf8').trim();
    console.log('\n=== 2/2  Merkle root ===');
    const tx = await contract.setMerkleRoot(root);
    await tx.wait();
    console.log(`  ✓ root set: ${root}`);
  } else {
    console.log('\n⚠️  No merkle-root.txt found — run 98-build-merkle.ts first, then re-run this script.');
  }

  console.log('\n✅  Done. Deployer cost: ~0.1 ETH. Users pay their own mint storage.');
}

main().catch(err => { console.error(err); process.exit(1); });
