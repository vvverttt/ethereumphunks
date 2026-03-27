import hre from 'hardhat';

// Standard lottery proxy
const standardProxy = '0x29b0d38112e8e743b63EB463F3351ab0F1E15977';

// These 3 hashIds are in the contract pool but are INVALID ethscriptions
// on ethscriptions.com (they exist on-chain as creation txs, but the same
// content was already minted earlier, making them protocol-invalid duplicates).
// Winning them in the lottery would give the winner nothing.
// Remove them from the pool so only valid prizes remain.
const invalidHashIds = [
  '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d', // #1569
  '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0', // #9360
  '0x554205831931235cbee89cfc56facf1f32e9128674a522b9e2d4a6c7d9507919', // #8699
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  console.log(`Proxy:  ${standardProxy}`);
  console.log(`Withdrawing ${invalidHashIds.length} invalid (protocol-duplicate) items from pool...\n`);

  const lottery = await hre.ethers.getContractAt('PhilipLotteryV67', standardProxy);

  for (const hashId of invalidHashIds) {
    const inPool = await lottery.inPool(hashId);
    console.log(`  ${hashId} — inPool: ${inPool}`);
    if (!inPool) {
      console.log(`    → already gone, skipping`);
      continue;
    }
  }

  console.log('\nCalling withdrawPrizeBatch...');
  const tx = await lottery.withdrawPrizeBatch(invalidHashIds);
  console.log(`  tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`  Confirmed in block ${receipt?.blockNumber}`);

  // Verify removed
  for (const hashId of invalidHashIds) {
    const inPool = await lottery.inPool(hashId);
    console.log(`  ${hashId.slice(0, 20)}... inPool: ${inPool}`);
  }

  const poolSize = await lottery.getPoolSize();
  console.log(`\nNew pool size: ${poolSize} (expected 1247)`);
  console.log(`ethscriptions.com count and contract pool now in sync.`);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
