import hre from 'hardhat';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8');

  const before = await contract.freeClaims('0x1d5590436811f11e3b89ee74cb096abb4ecd0a2b');
  console.log('0x1d55... current claims:', before.toString());

  console.log('Setting to 2...');
  const tx = await contract.setFreeClaims('0x1d5590436811f11e3b89ee74cb096abb4ecd0a2b', 2);
  await tx.wait();
  console.log('TX:', tx.hash);

  const after = await contract.freeClaims('0x1d5590436811f11e3b89ee74cb096abb4ecd0a2b');
  console.log('After:', after.toString());
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
