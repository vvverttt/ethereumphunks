import hre from 'hardhat';

const PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

// OG Dysto Phunk #10318 hashId
const HASH_ID = '0x913860c1bdcb9eb02d4b1451ca78a13e4cec9f8a5dc6c5ae9987b623d02f9c04';

async function withdraw() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Withdrawing ethscription from:', PROXY_ADDRESS);
  console.log('  HashId:', HASH_ID);
  console.log('  To:', signer.address);
  console.log('=====================================================================');

  const contract = await hre.ethers.getContractAt('Mutation', PROXY_ADDRESS, signer);

  const tx = await contract.withdrawEthscription(HASH_ID, signer.address);
  console.log('  Tx hash:', tx.hash);

  const receipt = await tx.wait();
  console.log('  Status:', receipt?.status);
  console.log('  Logs:', receipt?.logs.length);

  console.log('\n=====================================================================');
  console.log('Withdraw complete!');
  console.log('=====================================================================\n');
}

withdraw().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
