import hre from 'hardhat';
import { OG_MISSING_PHUNKS_PAIRS, OG_DYSTO_PHUNKS_PAIRS } from '../evolve-pairs-data';

const EVOLVE_PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

const BATCH_SIZE = 50; // Register in batches to avoid gas limits

export async function registerEvolvePairs() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Registering evolve pairs on:', EVOLVE_PROXY_ADDRESS);
  console.log('  Signer:', signer.address);
  console.log('=====================================================================');

  const contract = await hre.ethers.getContractAt(
    'Mutation',
    EVOLVE_PROXY_ADDRESS,
    signer
  );

  const allPairs = [
    ...OG_MISSING_PHUNKS_PAIRS,
    ...OG_DYSTO_PHUNKS_PAIRS,
  ];

  console.log(`\nTotal pairs to register: ${allPairs.length}`);

  for (let i = 0; i < allPairs.length; i += BATCH_SIZE) {
    const batch = allPairs.slice(i, i + BATCH_SIZE);
    const ogIds = batch.map(p => p.og);
    const quantumIds = batch.map(p => p.quantum);

    console.log(`\nRegistering batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} pairs)...`);

    const tx = await contract.registerPairs(ogIds, quantumIds);
    const receipt = await tx.wait();
    console.log(`  Tx: ${receipt?.hash}`);
    console.log(`  Gas used: ${receipt?.gasUsed.toString()}`);
  }

  const totalPairs = await contract.pairCount();
  console.log(`\n=====================================================================`);
  console.log(`Done! Total pairs registered: ${totalPairs.toString()}`);
  console.log(`=====================================================================\n`);
}

registerEvolvePairs().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
