import hre from 'hardhat';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8');

  const before = await contract.totalSwapped();
  console.log('totalSwapped before:', before.toString());

  // resetTotalRevealed resets totalRevealed, but we need to reset totalSwapped
  // There's no function for that... need to check
  const totalRevealed = await contract.totalRevealed();
  console.log('totalRevealed:', totalRevealed.toString());
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
