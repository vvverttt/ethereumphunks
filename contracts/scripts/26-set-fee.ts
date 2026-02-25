import hre from 'hardhat';

const PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';
const NEW_FEE = hre.ethers.parseEther('0.00001');

async function setFee() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Calling setFee() on:', PROXY_ADDRESS);
  console.log('  New fee:', hre.ethers.formatEther(NEW_FEE), 'ETH');
  console.log('  Signer:', signer.address);
  console.log('=====================================================================');

  const contract = await hre.ethers.getContractAt('Mutation', PROXY_ADDRESS, signer);

  const oldFee = await contract.evolveFee();
  console.log('  Current fee:', hre.ethers.formatEther(oldFee), 'ETH');

  const tx = await contract.setFee(NEW_FEE);
  console.log('  Tx hash:', tx.hash);

  const receipt = await tx.wait();
  console.log('  Status:', receipt?.status);

  const newFee = await contract.evolveFee();
  console.log('  New fee:', hre.ethers.formatEther(newFee), 'ETH');

  console.log('\n=====================================================================');
  console.log('Fee updated!');
  console.log('=====================================================================\n');
}

setFee().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
