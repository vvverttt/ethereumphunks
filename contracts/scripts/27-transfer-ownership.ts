import hre from 'hardhat';

const PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';
const NEW_OWNER = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

async function transferOwnership() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Calling transferOwnership() on:', PROXY_ADDRESS);
  console.log('  New owner:', NEW_OWNER);
  console.log('  Signer:', signer.address);
  console.log('=====================================================================');

  const contract = await hre.ethers.getContractAt('Mutation', PROXY_ADDRESS, signer);

  const currentOwner = await contract.owner();
  console.log('  Current owner:', currentOwner);

  const tx = await contract.transferOwnership(NEW_OWNER);
  console.log('  Tx hash:', tx.hash);

  const receipt = await tx.wait();
  console.log('  Status:', receipt?.status);

  const newOwner = await contract.owner();
  console.log('  New owner:', newOwner);

  console.log('\n=====================================================================');
  console.log('Ownership transferred!');
  console.log('=====================================================================\n');
}

transferOwnership().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
