import hre from 'hardhat';
import { readFileSync } from 'fs';

const proxyAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', proxyAddress);

  // Load EtherPhunks JSON
  const json = JSON.parse(readFileSync('C:/Users/alber/OneDrive/Desktop/etherphunks/ethereumphunks/ethereum-phunks (2).json', 'utf8'));
  const hashIds: string[] = json.collection_items.map((item: any) => item.id);

  console.log(`Total EtherPhunks hashIds: ${hashIds.length}`);

  // Set in batches of 500 — resume from where we left off
  const batchSize = 500;
  const startFrom = 1000; // Already loaded 0-999
  for (let i = startFrom; i < hashIds.length; i += batchSize) {
    const batch = hashIds.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(hashIds.length / batchSize);
    console.log(`Setting batch ${batchNum}/${totalBatches} (${batch.length} items)...`);
    const tx = await contract.setEligibleEthscriptionBatchSwap(batch, true);
    await tx.wait();
    console.log(`  TX: ${tx.hash}`);
  }

  // Verify
  console.log('\nVerifying...');
  const first = await contract.eligibleEthscriptionBatch(hashIds[0]);
  const last = await contract.eligibleEthscriptionBatch(hashIds[hashIds.length - 1]);
  const fake = await contract.eligibleEthscriptionBatch('0x' + '00'.repeat(32));
  console.log(`  First: ${first}`);
  console.log(`  Last:  ${last}`);
  console.log(`  Fake:  ${fake}`);

  console.log(`\nDone. ${hashIds.length} EtherPhunks set as eligible for batch swap.`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
