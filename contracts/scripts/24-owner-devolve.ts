import hre from 'hardhat';

const PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

// Quantum Dysto Phunk #10318 hashId
const HASH_ID = '0x58574b96c9a541a5e9fad7b14d6acca4645078403a041e3369053cfe30e27dd0';

async function ownerDevolve() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Calling devolve() on:', PROXY_ADDRESS);
  console.log('  HashId:', HASH_ID);
  console.log('  Signer:', signer.address);
  console.log('=====================================================================');

  const contract = await hre.ethers.getContractAt('Mutation', PROXY_ADDRESS, signer);

  // Check current state
  const depositorAddr = await contract.depositor(HASH_ID);
  console.log('  Depositor:', depositorAddr);

  const pairId = await contract.pairIdOf(HASH_ID);
  console.log('  PairId:', pairId.toString());

  const isOg = await contract.isOg(HASH_ID);
  console.log('  IsOg:', isOg);

  const tx = await contract.devolve(HASH_ID);
  console.log('  Tx hash:', tx.hash);

  const receipt = await tx.wait();
  console.log('  Status:', receipt?.status);
  console.log('  Logs:', receipt?.logs.length);

  console.log('\n=====================================================================');
  console.log('Devolve complete!');
  console.log('=====================================================================\n');
}

ownerDevolve().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
