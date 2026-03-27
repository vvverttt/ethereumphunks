import hre from 'hardhat';

// Standard lottery proxy
const standardProxy = '0x29b0d38112e8e743b63EB463F3351ab0F1E15977';

// These 3 hashIds are in the contract pool but ethscriptions.com doesn't
// recognize the lottery as owner because their deposit tx was part of a
// batch where the depositor wasn't considered the owner by the ESIP-5 rule.
// Calling reEmitDepositEvents emits ESIP-2 transfer events so ethscriptions.com
// updates ownership to the lottery contract.
const missingHashIds = [
  '0xf770cba11e1ce1e919b8e5a0d1815845458a993aa6e20d8d553863743cba0ed4', // #8588
  '0x8ddd79d50715f1567b749c15722d1a0a8055e3481687a34120ac0f746d05e220', // #2229
  // Add third hashId here if identified
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  console.log(`Proxy:  ${standardProxy}`);
  console.log(`Fixing ${missingHashIds.length} items...\n`);

  const lottery = await hre.ethers.getContractAt('PhilipLotteryV67', standardProxy);

  // Verify all items are in pool before sending tx
  for (const hashId of missingHashIds) {
    const inPool = await lottery.inPool(hashId);
    const dep = await lottery.depositor(hashId);
    console.log(`  ${hashId} — inPool: ${inPool}, depositor: ${dep}`);
    if (!inPool) throw new Error(`${hashId} is NOT in pool — aborting`);
  }

  console.log('\nSending reEmitDepositEvents tx...');
  const tx = await lottery.reEmitDepositEvents(missingHashIds);
  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  Confirmed in block ${receipt?.blockNumber}`);
  console.log(`  ethscriptions.com should now show 1250 for the lottery wallet.`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
