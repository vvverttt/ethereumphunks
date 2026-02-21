import hre from 'hardhat';

const PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

async function withdrawETH() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Calling withdrawETH() on:', PROXY_ADDRESS);
  console.log('  Signer:', signer.address);
  console.log('=====================================================================');

  const contract = await hre.ethers.getContractAt('Mutation', PROXY_ADDRESS, signer);

  const balance = await hre.ethers.provider.getBalance(PROXY_ADDRESS);
  console.log('  Contract balance:', hre.ethers.formatEther(balance), 'ETH');

  if (balance === 0n) {
    console.log('  No funds to withdraw.');
    return;
  }

  const tx = await contract.withdrawETH();
  console.log('  Tx hash:', tx.hash);

  const receipt = await tx.wait();
  console.log('  Status:', receipt?.status);

  const newBalance = await hre.ethers.provider.getBalance(PROXY_ADDRESS);
  console.log('  Contract balance after:', hre.ethers.formatEther(newBalance), 'ETH');

  console.log('\n=====================================================================');
  console.log('Withdraw complete!');
  console.log('=====================================================================\n');
}

withdrawETH().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
