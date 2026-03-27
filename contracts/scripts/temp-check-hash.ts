import hre from 'hardhat';

async function main() {
  const addr = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
  const contract = await hre.ethers.getContractAt('EthsRocksV2', addr);
  const hashId = '0xcdc5907b49aba4a15f820f8c49310f6e2c54c0da131ee39982897229ab07dd5a';

  console.log('inPool:', await contract.inPool(hashId));
  console.log('depositor:', await contract.depositor(hashId));
  console.log('poolSize:', Number(await contract.poolSize()));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
