import hre from 'hardhat';
import { readFileSync } from 'fs';
import { keccak256, solidityPacked } from 'ethers';

const PROXY = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
const CALLER = '0x436196aB0550E73AEEdd1a494C2420DAcA7Fe0Ca';

const hashes = [
  '0x309c24278537c4337d93f96e287ba1bca820ecbb53799d32236847a261d1ed3b',
  '0x0a9c1c695d9e20bfeab770dc4b50b5d2fcc59aa489f6fc8b450e8ef2b5c8386b',
  '0x3a17681a2075a204a9ee8fb47edbddac5bbcd73ddce4efc3cd84dbbe837fc8f4',
  '0x6fc2dc9f8166a368a4f9e2f2696810f2acecbfb3607c4140c7b0158275f1943c',
  '0x032793ffe8fb83318544ebda6123734da3982b2be42086be7666124c605d7efb',
];

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', PROXY);

  console.log('swapEnabled:', await contract.swapEnabled());
  console.log('pool:', (await contract.poolSize()).toString());
  console.log('batchRequired:', (await contract.ethscriptionBatchRequired()).toString());
  console.log('merkleRoot:', await contract.batchSwapMerkleRoot());

  for (const h of hashes) {
    const used = await contract.usedBatchEthscription(h);
    const dep = await contract.userEthscriptionPossiblyStored(CALLER, h);
    console.log(h.slice(0, 10), 'used:', used, 'deposited:', dep);
  }

  // Build Merkle tree
  const json = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/etherphunks/ethereumphunks/ethereum-phunks (2).json', 'utf8'));
  let leaves = json.collection_items.map((i: any) => i.id.toLowerCase()).sort();
  const tree: string[][] = [leaves];
  let layer = leaves;
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        const [a, b] = layer[i] < layer[i + 1] ? [layer[i], layer[i + 1]] : [layer[i + 1], layer[i]];
        next.push(keccak256(solidityPacked(['bytes32', 'bytes32'], [a, b])));
      } else next.push(layer[i]);
    }
    layer = next;
    tree.push(layer);
  }
  console.log('Computed root:', layer[0]);

  const proofs = hashes.map(h => {
    h = h.toLowerCase();
    let idx = tree[0].indexOf(h);
    const proof: string[] = [];
    for (let i = 0; i < tree.length - 1; i++) {
      const sibIdx = idx % 2 === 1 ? idx - 1 : idx + 1;
      if (sibIdx < tree[i].length) proof.push(tree[i][sibIdx]);
      idx = Math.floor(idx / 2);
    }
    return proof;
  });

  console.log('Proofs:', proofs.map(p => p.length));

  try {
    await contract.swapEthscriptionBatch.staticCall(hashes, proofs, { from: CALLER });
    console.log('\nWOULD SUCCEED');
  } catch (e: any) {
    console.log('\nREVERT:', e.reason || e.revert || e.data || e.message?.slice(0, 150));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
