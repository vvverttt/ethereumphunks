import hre from 'hardhat';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8');
  const claims = await contract.freeClaims('0x4212d149f77308a87ce9928f1095eddb894f4d68');
  console.log('0x4212... current claims:', claims.toString());
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
