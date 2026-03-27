import hre from 'hardhat';

const proxyAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';

// Wallets that listed/sold above 0.67 ETH, never below in either collection
const OG_MISSING = [
  '0x2fdc93722c9a86fdfb4d945caf059f39cb9622be',
  '0x32f12843e7dba0e9452f5223713bb9a332313d2e',
  '0x1d5590436811f11e3b89ee74cb096abb4ecd0a2b',
];

const OG_DYSTO = [
  '0x1d5590436811f11e3b89ee74cb096abb4ecd0a2b',
  '0xed088bfa882e951b8627681ac0b5199bb4567f25',
];

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', proxyAddress);

  console.log('Adding 1 free claim for 3 OG Missing wallets...');
  const tx1 = await contract.addFreeClaimsBatch(OG_MISSING, 1);
  await tx1.wait();
  console.log('  TX:', tx1.hash);

  console.log('Adding 1 free claim for 2 OG Dysto wallets...');
  const tx2 = await contract.addFreeClaimsBatch(OG_DYSTO, 1);
  await tx2.wait();
  console.log('  TX:', tx2.hash);

  // Verify overlap wallet
  const overlap = await contract.freeClaims('0x1d5590436811f11e3b89ee74cb096abb4ecd0a2b');
  console.log(`\nOverlap wallet 0x1d55... claims: ${overlap}`);

  console.log('\nDone. 4 unique wallets, 5 total new claims added.');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
