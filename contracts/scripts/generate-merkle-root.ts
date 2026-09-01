/**
 * Generate Merkle Root for EthsRocks Sale Contract
 *
 * Eligible wallets must hold ALL THREE ethscription collections:
 *   1. MissingPhunk (any version: og-missing-phunks, missing-phunks, quantummissingphunksv67)
 *   2. QuantumDystoPhunk (quantumdystophunkzv67 only)
 *   3. QuantumPhunk (cryptophunksv67)
 *
 * Each leaf = keccak256(abi.encodePacked(address, missingPhunkHash, quantumDystoHash, quantumPhunkHash))
 *
 * Usage: npx ts-node scripts/generate-merkle-root.ts
 */

import { MerkleTree } from 'merkletreejs';
import { keccak256, encodePacked } from 'viem';
import * as fs from 'fs';

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = (process.env.SUPABASE_KEY || '');

// Collection slugs
const MISSING_PHUNK_SLUGS = ['og-missing-phunks', 'missing-phunks', 'quantummissingphunksv67'];
const QUANTUM_DYSTO_SLUG = 'quantumdystophunkzv67';
const QUANTUM_PHUNK_SLUG = 'cryptophunksv67';

interface Ethscription {
  hashId: string;
  owner: string;
  slug: string;
  tokenId: number;
}

async function fetchEthscriptions(slug: string): Promise<Ethscription[]> {
  const all: Ethscription[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/ethscriptions?slug=eq.${slug}&select=hashId,owner,slug,tokenId&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    const data: Ethscription[] = await res.json();
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }

  return all;
}

async function main() {
  console.log('Fetching ethscriptions from Supabase...\n');

  // Fetch all collections
  const missingPhunks: Ethscription[] = [];
  for (const slug of MISSING_PHUNK_SLUGS) {
    const items = await fetchEthscriptions(slug);
    missingPhunks.push(...items);
    console.log(`  ${slug}: ${items.length} items`);
  }

  const quantumDystos = await fetchEthscriptions(QUANTUM_DYSTO_SLUG);
  console.log(`  ${QUANTUM_DYSTO_SLUG}: ${quantumDystos.length} items`);

  const quantumPhunks = await fetchEthscriptions(QUANTUM_PHUNK_SLUG);
  console.log(`  ${QUANTUM_PHUNK_SLUG}: ${quantumPhunks.length} items`);

  // Group by owner
  const missingByOwner = new Map<string, Ethscription[]>();
  for (const e of missingPhunks) {
    const owner = e.owner.toLowerCase();
    if (!missingByOwner.has(owner)) missingByOwner.set(owner, []);
    missingByOwner.get(owner)!.push(e);
  }

  const dystoByOwner = new Map<string, Ethscription[]>();
  for (const e of quantumDystos) {
    const owner = e.owner.toLowerCase();
    if (!dystoByOwner.has(owner)) dystoByOwner.set(owner, []);
    dystoByOwner.get(owner)!.push(e);
  }

  const phunkByOwner = new Map<string, Ethscription[]>();
  for (const e of quantumPhunks) {
    const owner = e.owner.toLowerCase();
    if (!phunkByOwner.has(owner)) phunkByOwner.set(owner, []);
    phunkByOwner.get(owner)!.push(e);
  }

  // Find eligible wallets (hold all three)
  const eligibleAddresses = new Set<string>();
  for (const addr of missingByOwner.keys()) {
    if (dystoByOwner.has(addr) && phunkByOwner.has(addr)) {
      eligibleAddresses.add(addr);
    }
  }

  console.log(`\nEligible wallets (hold all 3 collections): ${eligibleAddresses.size}`);

  // Generate leaves: one per valid combination of (address, missingHash, dystoHash, phunkHash)
  interface LeafData {
    address: string;
    missingPhunkHash: string;
    quantumDystoHash: string;
    quantumPhunkHash: string;
    leaf: string;
  }

  const leafDataList: LeafData[] = [];

  for (const addr of eligibleAddresses) {
    const missing = missingByOwner.get(addr)!;
    const dystos = dystoByOwner.get(addr)!;
    const phunks = phunkByOwner.get(addr)!;

    // Generate all valid combinations
    for (const m of missing) {
      for (const d of dystos) {
        for (const p of phunks) {
          const leaf = keccak256(encodePacked(
            ['address', 'bytes32', 'bytes32', 'bytes32'],
            [addr as `0x${string}`, m.hashId as `0x${string}`, d.hashId as `0x${string}`, p.hashId as `0x${string}`]
          ));
          leafDataList.push({
            address: addr,
            missingPhunkHash: m.hashId,
            quantumDystoHash: d.hashId,
            quantumPhunkHash: p.hashId,
            leaf,
          });
        }
      }
    }
  }

  console.log(`Total leaves (all combinations): ${leafDataList.length}`);

  if (leafDataList.length === 0) {
    console.log('\nNo eligible wallets found. Cannot generate merkle tree.');
    return;
  }

  // Build merkle tree
  const leaves = leafDataList.map(d => d.leaf);
  const tree = new MerkleTree(leaves, keccak256 as any, { sortPairs: true });
  const root = tree.getHexRoot();

  console.log(`\nMerkle Root: ${root}`);

  // Generate proofs per address
  const proofsByAddress: Record<string, Array<{
    missingPhunkHash: string;
    quantumDystoHash: string;
    quantumPhunkHash: string;
    proof: string[];
  }>> = {};

  for (const data of leafDataList) {
    const proof = tree.getHexProof(data.leaf);

    if (!proofsByAddress[data.address]) {
      proofsByAddress[data.address] = [];
    }
    proofsByAddress[data.address].push({
      missingPhunkHash: data.missingPhunkHash,
      quantumDystoHash: data.quantumDystoHash,
      quantumPhunkHash: data.quantumPhunkHash,
      proof,
    });
  }

  // Output
  const output = {
    root,
    totalEligible: eligibleAddresses.size,
    totalLeaves: leafDataList.length,
    generatedAt: new Date().toISOString(),
    proofsByAddress,
  };

  const outputPath = './scripts/ethsrocks-merkle.json';
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nOutput written to: ${outputPath}`);
  console.log(`\nNext step: Call setMerkleRoot("${root}") on the contract`);
}

main().catch(console.error);
