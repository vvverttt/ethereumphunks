import hre from 'hardhat';

const evolveProxy = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';
const ogHash = '0xc4b0ca5fe27e8fe0d33746d7f803aca9311ecc27862b21120370ba9727c0d6cb';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Signer:', signer.address);

  const evolve = await hre.ethers.getContractAt('Mutation', evolveProxy);

  console.log('Calling evolve() for phunk 10169...');
  const tx = await evolve.evolve(ogHash, { value: 0 });
  console.log('Tx hash:', tx.hash);

  const receipt = await tx.wait();
  console.log('Status:', receipt!.status);
  console.log('Events:');
  receipt!.logs.forEach((l: any, i: number) => {
    console.log(`  Log ${i}:`, l.fragment?.name || l.topics[0]);
  });
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
