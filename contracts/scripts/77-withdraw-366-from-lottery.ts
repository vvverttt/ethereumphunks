import hre from 'hardhat';

const LOTTERY = '0x29b0d38112e8e743b63EB463F3351ab0F1E15977';
const HASH_ID = '0xf203be22b308b831da56f630e6a94b512adbb14e51e55df0ae103af9e5f77a17';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Signer:', signer.address);

  const contract = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY, signer);

  const inPool = await contract.inPool(HASH_ID);
  console.log('#366 inPool:', inPool);
  if (!inPool) {
    console.log('#366 is NOT in the pool — nothing to withdraw');
    return;
  }

  console.log('Withdrawing #366 from lottery...');
  const tx = await contract.withdrawPrize(HASH_ID);
  const receipt = await tx.wait();
  console.log(`TX: ${receipt?.hash} status=${receipt?.status}`);

  const inPoolAfter = await contract.inPool(HASH_ID);
  console.log('#366 inPool after:', inPoolAfter);
  console.log('Done ✅');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
