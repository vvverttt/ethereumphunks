import hre from 'hardhat';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8');

  const before = await contract.freeClaims('0x4212d149f77308a87ce9928f1095eddb894f4d68');
  console.log('0x4212... current claims:', before.toString());

  console.log('Setting to 0...');
  const tx = await contract.setFreeClaims('0x4212d149f77308a87ce9928f1095eddb894f4d68', 0);
  await tx.wait();
  console.log('TX:', tx.hash);

  const after = await contract.freeClaims('0x4212d149f77308a87ce9928f1095eddb894f4d68');
  console.log('After:', after.toString());
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
