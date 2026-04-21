import { ethers } from 'hardhat';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
//  Build merkle tree for ERC721PhunksV67 mint.
//
//  Each leaf commits to ALL token data:
//    [to, tokenId, hashId, sha, imageUri, label, traitKeys[], traitValues[]]
//
//  Users submit everything at mint — they pay 100% of storage gas.
//  Owner pays nothing except setting the root (1 tx).
//
//  Output:
//    scripts/merkle-root.txt     — set this on the contract via setMerkleRoot
//    scripts/merkle-proofs.json  — serve from API for the mint UI
//
//  Usage:
//    npx hardhat run scripts/98-build-merkle.ts
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_BASE = 'https://kfnprbhoodmgfhqojmqp.supabase.co/storage/v1/object/public/static/images';
const DATA_DIR      = path.resolve(__dirname, '../../New folder');
const IMG_CACHE_DIR = path.resolve(__dirname, '../.image-cache');
const OUT_ROOT      = path.resolve(__dirname, './merkle-root.txt');
const OUT_PROOFS    = path.resolve(__dirname, './merkle-proofs.json');

if (!fs.existsSync(IMG_CACHE_DIR)) fs.mkdirSync(IMG_CACHE_DIR);

const FILES = [
  '1 - CryptoPhunksV67 (1).json',
  '2 - QuantumMissingPhunksV67 (1).json',
  '3 - QuantumDystoPhunkzV67 (1).json',
];

interface CollectionItem {
  id: string;
  index: number;
  sha: string;
  name: string;
  attributes: { trait_type: string; value: string }[];
}

// Fetch image → data:image/png;base64,... with disk cache
async function fetchDataUri(sha: string): Promise<string> {
  const cachePath = path.join(IMG_CACHE_DIR, sha);
  if (fs.existsSync(cachePath)) return fs.readFileSync(cachePath, 'utf8');
  const res = await fetch(`${SUPABASE_BASE}/${sha}`);
  if (!res.ok) throw new Error(`Failed ${sha}: ${res.status}`);
  const uri = `data:image/png;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  fs.writeFileSync(cachePath, uri, 'utf8');
  return uri;
}

async function main() {
  // ── Load owner addresses from Supabase ──────────────────────────────────
  // We need the current ethscription owner for each hashId so `to` is correct.
  // Pull from your ethscriptions table: SELECT "hashId", owner FROM ethscriptions
  // For now we load from a local owners.json if it exists, otherwise use ZeroAddress.
  const ownersFile = path.resolve(__dirname, './owners.json');
  const ownerMap: Record<string, string> = fs.existsSync(ownersFile)
    ? JSON.parse(fs.readFileSync(ownersFile, 'utf8'))
    : {};
  const hasOwners = Object.keys(ownerMap).length > 0;
  if (!hasOwners) {
    console.warn('⚠️  No owners.json found — using ZeroAddress for all `to` fields.');
    console.warn('    Run 99-export-owners.ts to generate owners.json, then re-run this script.\n');
  }

  // ── Load collection data ─────────────────────────────────────────────────
  const allItems: CollectionItem[] = [];
  for (const file of FILES) {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    allItems.push(...raw.collection_items);
    console.log(`Loaded ${raw.collection_items.length} from ${file}`);
  }
  console.log(`\nTotal: ${allItems.length} items`);

  // ── Fetch all images (cached after first run) ────────────────────────────
  console.log('Fetching images...\n');
  const CONCURRENCY = 50;
  const dataUris: string[] = new Array(allItems.length);
  for (let i = 0; i < allItems.length; i += CONCURRENCY) {
    const slice = allItems.slice(i, i + CONCURRENCY);
    const uris  = await Promise.all(slice.map(item => fetchDataUri(item.sha)));
    uris.forEach((uri, j) => { dataUris[i + j] = uri; });
    process.stdout.write(`  ${Math.min(i + CONCURRENCY, allItems.length)}/${allItems.length} fetched\r`);
  }
  console.log('\nAll images ready.\n');

  // ── Build leaves ─────────────────────────────────────────────────────────
  // Types must match the contract's abi.encode call exactly:
  // (address, uint256, bytes32, bytes32, string, string, string[], string[])
  const leaves = allItems.map((item, idx) => [
    (ownerMap[item.id.toLowerCase()] ?? ethers.ZeroAddress) as string,
    BigInt(item.index),
    item.id as string,
    ('0x' + item.sha) as string,
    dataUris[idx],
    item.name,
    item.attributes.map(a => a.trait_type),
    item.attributes.map(a => a.value),
  ]);

  console.log('Building merkle tree...');
  const tree = StandardMerkleTree.of(leaves, [
    'address',   // to
    'uint256',   // tokenId
    'bytes32',   // hashId
    'bytes32',   // sha
    'string',    // imageUri
    'string',    // label
    'string[]',  // traitKeys
    'string[]',  // traitValues
  ]);

  const root = tree.root;
  console.log('\n✅  Merkle root:', root);
  fs.writeFileSync(OUT_ROOT, root, 'utf8');
  console.log('    Saved to', OUT_ROOT);

  fs.writeFileSync(OUT_PROOFS, JSON.stringify(tree.dump(), null, 2), 'utf8');
  console.log('    Proofs saved to', OUT_PROOFS, `(${(fs.statSync(OUT_PROOFS).size / 1024 / 1024).toFixed(1)} MB)`);

  console.log('\nNext:');
  if (!hasOwners) {
    console.log('  1. Run: npx hardhat run scripts/99-export-owners.ts');
    console.log('  2. Re-run this script to get final root with real owner addresses');
    console.log('  3. Run: npx hardhat run scripts/97-seed-erc721phunks.ts --network mainnet');
  } else {
    console.log('  1. Run: npx hardhat run scripts/97-seed-erc721phunks.ts --network mainnet');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
