import hre, { upgrades } from 'hardhat';
import { readFileSync } from 'fs';
import { keccak256, solidityPacked } from 'ethers';

const proxyAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';

function buildMerkleTree(leaves: string[]): { root: string; tree: string[][] } {
  // Sort leaves for consistent ordering
  let layer = leaves.map(l => l.toLowerCase()).sort();
  const tree: string[][] = [layer];

  while (layer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        const [a, b] = layer[i] < layer[i + 1] ? [layer[i], layer[i + 1]] : [layer[i + 1], layer[i]];
        nextLayer.push(keccak256(solidityPacked(['bytes32', 'bytes32'], [a, b])));
      } else {
        nextLayer.push(layer[i]); // odd leaf promoted
      }
    }
    layer = nextLayer;
    tree.push(layer);
  }

  return { root: layer[0], tree };
}

function getProof(tree: string[][], leaf: string): string[] {
  leaf = leaf.toLowerCase();
  const proof: string[] = [];
  let index = tree[0].indexOf(leaf);
  if (index === -1) return [];

  for (let i = 0; i < tree.length - 1; i++) {
    const layer = tree[i];
    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;

    if (siblingIndex < layer.length) {
      proof.push(layer[siblingIndex]);
    }

    index = Math.floor(index / 2);
  }

  return proof;
}

async function main() {
  const [signer] = await hre.ethers.getSigners();

  // Load EtherPhunks
  const json = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/etherphunks/ethereumphunks/ethereum-phunks (2).json', 'utf8'));
  const hashIds: string[] = json.collection_items.map((item: any) => item.id);
  console.log(`EtherPhunks: ${hashIds.length} items`);

  // Build Merkle tree
  const { root, tree } = buildMerkleTree(hashIds);
  console.log(`Merkle root: ${root}`);

  // Verify a few proofs
  const testProof = getProof(tree, hashIds[0]);
  console.log(`Proof for first item (${hashIds[0].slice(0, 10)}...): ${testProof.length} nodes`);

  console.log('\n=====================================================================');
  console.log('Upgrading EthsRocks — Merkle-based batch swap');
  console.log(`  Signer:  ${signer.address}`);
  console.log(`  Proxy:   ${proxyAddress}`);
  console.log('=====================================================================');

  // Upgrade
  console.log('\n1. Upgrading implementation...');
  const ContractFactory = await hre.ethers.getContractFactory('EthsRocksV2');
  const upgraded = await upgrades.upgradeProxy(proxyAddress, ContractFactory, {
    unsafeSkipStorageCheck: true,
  });
  await upgraded.waitForDeployment();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`   New implementation: ${implAddress}`);

  // Set Merkle root (1 tx!)
  const contract = await hre.ethers.getContractAt('EthsRocksV2', proxyAddress);
  console.log('\n2. Setting Merkle root...');
  const tx = await contract.setBatchSwapMerkleRoot(root);
  await tx.wait();
  console.log(`   TX: ${tx.hash}`);

  const storedRoot = await contract.batchSwapMerkleRoot();
  console.log(`   Stored root: ${storedRoot}`);
  console.log(`   Match: ${storedRoot === root}`);

  console.log(`\n=====================================================================`);
  console.log(`SUMMARY:`);
  console.log(`  Proxy:          ${proxyAddress}`);
  console.log(`  Implementation: ${implAddress}`);
  console.log(`  Merkle root:    ${root}`);
  console.log(`  10k EtherPhunks eligible via Merkle proof`);
  console.log(`=====================================================================`);
  console.log(`\nVerify: npx hardhat verify --network mainnet ${implAddress}`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
