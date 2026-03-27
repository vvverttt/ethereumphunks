import hre from 'hardhat';
import fs from 'fs';

const PROXY = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

async function main() {
  const contract = await hre.ethers.getContractAt('Mutation', PROXY);
  const pairCount = await contract.pairCount();
  console.log(`pairCount: ${pairCount}`);

  const results: { pairId: number; tokenId?: number; ogHashId: string; quantumHashId: string; ogDepositor: string; quantumDepositor: string }[] = [];

  for (let pid = 0; pid < pairCount; pid++) {
    const ogHash = await contract.ogHashId(pid);
    const qHash = await contract.quantumHashId(pid);
    const ogDep = await contract.depositor(ogHash);
    const qDep = await contract.depositor(qHash);
    const ZERO = '0x0000000000000000000000000000000000000000';

    if (ogDep !== ZERO || qDep !== ZERO) {
      results.push({
        pairId: pid,
        ogHashId: ogHash,
        quantumHashId: qHash,
        ogDepositor: ogDep,
        quantumDepositor: qDep,
      });
    }
  }

  console.log(`\n${results.length} pairs with deposited tokens:\n`);
  results.forEach(r => {
    if (r.ogDepositor !== '0x0000000000000000000000000000000000000000')
      console.log(`pid=${r.pairId} OG deposited: ${r.ogHashId.slice(0,18)}...`);
    if (r.quantumDepositor !== '0x0000000000000000000000000000000000000000')
      console.log(`pid=${r.pairId} Quantum deposited: ${r.quantumHashId.slice(0,18)}...`);
  });

  fs.writeFileSync('contract-ethscriptions.json', JSON.stringify(results, null, 2));
  console.log('\nWritten to contract-ethscriptions.json');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
