import hre from 'hardhat';

const PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

// OG Dysto Phunk #10318 hashId (from your previous tx)
const HASH_ID = '0x913860c1bdcb9eb02d4b1451ca78a13e4cec9f8a5dc6c5ae9987b623d02f9c04';

async function ownerEvolve() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Calling evolve() on:', PROXY_ADDRESS);
  console.log('  HashId:', HASH_ID);
  console.log('  Signer:', signer.address);
  console.log('=====================================================================');

  const contract = await hre.ethers.getContractAt('Mutation', PROXY_ADDRESS, signer);

  // Check current state
  const depositorAddr = await contract.depositor(HASH_ID);
  console.log('  Depositor:', depositorAddr);

  const pairId = await contract.pairIdOf(HASH_ID);
  console.log('  PairId:', pairId.toString());

  const paid = await contract.feePaid(pairId);
  console.log('  Fee paid:', paid);

  const fee = await contract.evolveFee();
  console.log('  Evolve fee:', fee.toString(), 'wei');

  const value = paid ? 0n : fee;
  console.log('  Sending value:', value.toString(), 'wei');

  const tx = await contract.evolve(HASH_ID, { value });
  console.log('  Tx hash:', tx.hash);

  const receipt = await tx.wait();
  console.log('  Status:', receipt?.status);
  console.log('  Logs:', receipt?.logs.length);

  console.log('\n=====================================================================');
  console.log('Evolve complete!');
  console.log('=====================================================================\n');
}

ownerEvolve().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
