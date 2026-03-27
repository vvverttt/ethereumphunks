import hre from 'hardhat';

async function main() {
  const contract = await hre.ethers.getContractAt('PhilipLotteryV67', '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA');
  const hashId = '0xf203be22b308b831da56f630e6a94b512adbb14e51e55df0ae103af9e5f77a17';
  const inPool = await contract.inPool(hashId);
  const depositor = await contract.depositor(hashId);
  console.log('#366 inPool:', inPool);
  console.log('#366 depositor:', depositor);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
