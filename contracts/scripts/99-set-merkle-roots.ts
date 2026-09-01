import { ethers } from 'hardhat';
import { createClient } from '@supabase/supabase-js';

const PHUNKQUIDITY = '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A';
const SUPABASE_URL = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const SUPABASE_KEY = (process.env.SUPABASE_KEY || 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe');

// Ethscription-only collections (ERC721s don't need merkle roots)
const ETHSC_COLLECTIONS: { slugStr: string; contractSlug: string }[] = [
  { slugStr: 'ethereumphunks',  contractSlug: 'etherphunks'       },
  { slugStr: 'og-missing-phunks', contractSlug: 'og-missing-phunks' },
  { slugStr: 'og-dysto-phunks', contractSlug: 'og-dysto-phunks'   },
  { slugStr: 'cryptophunksv67', contractSlug: 'cryptophunksv67'   },
  { slugStr: 'ethsrocks',       contractSlug: 'ethsrocks'         },
];

function buildMerkleRoot(hashIds: string[]): string {
  if (hashIds.length === 0) throw new Error('No hashIds');
  let layer = [...hashIds].map(h => h.toLowerCase()).sort();
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        const [a, b] = layer[i] < layer[i + 1] ? [layer[i], layer[i + 1]] : [layer[i + 1], layer[i]];
        next.push(ethers.keccak256(ethers.concat([a, b])));
      } else {
        next.push(layer[i]);
      }
    }
    layer = next;
  }
  return layer[0];
}

async function fetchAllHashIds(supabase: any, slugStr: string): Promise<string[]> {
  const hashIds: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from('ethscriptions')
      .select('hashId')
      .eq('slug', slugStr)
      .range(offset, offset + 999);
    if (error) throw new Error(`Supabase error for ${slugStr}: ${error.message}`);
    if (!data?.length) break;
    hashIds.push(...data.map((d: any) => d.hashId.toLowerCase()));
    if (data.length < 1000) break;
    offset += 1000;
  }
  return hashIds;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const [signer] = await ethers.getSigners();
  console.log('Signer:', signer.address);

  const contract = await ethers.getContractAt(
    [
      'function setMerkleRoot(bytes32 slug, bytes32 root) external',
      'function collections(bytes32) view returns (uint8 collType, address contractAddress, bytes32 merkleRoot, uint256 pointValue, bool enabled, bool exists)',
      'function owner() view returns (address)',
    ],
    PHUNKQUIDITY,
    signer
  );

  const owner = await contract.owner();
  console.log('Contract owner:', owner);
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error('Signer is not owner. Use treasury wallet.');
  }

  for (const { slugStr, contractSlug } of ETHSC_COLLECTIONS) {
    console.log(`\nProcessing ${slugStr} (Supabase slug: ${slugStr})...`);

    const hashIds = await fetchAllHashIds(supabase, slugStr);
    console.log(`  Found ${hashIds.length} hashIds`);
    if (hashIds.length === 0) {
      console.log(`  Skipping — no items found`);
      continue;
    }

    const root = buildMerkleRoot(hashIds);
    console.log(`  Merkle root: ${root}`);

    const slug = ethers.keccak256(ethers.toUtf8Bytes(contractSlug));
    const current = await contract.collections(slug);
    console.log(`  Current root: ${current.merkleRoot}`);

    if (current.merkleRoot.toLowerCase() === root.toLowerCase()) {
      console.log(`  Already set, skipping`);
      continue;
    }

    console.log(`  Setting merkle root...`);
    const tx = await contract.setMerkleRoot(slug, root);
    await tx.wait();
    console.log(`  Done: ${tx.hash}`);
  }

  console.log('\nAll merkle roots set.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
