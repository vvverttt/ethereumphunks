import hre from 'hardhat';

// This needs to be called from the depositor's wallet, not owner
// Owner can use emergencyWithdrawEthscription instead

const PROXY = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
const HASH_ID = '0x0e1094cf7decc748b0029a64e6dcd3f19c5416e822319debd2532607793d9209';
const DEPOSITOR = '0x436196aB0550E73AEEdd1a494C2420DAcA7Fe0Ca';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', PROXY);

  // Check if it's deposited
  const stored = await contract.userEthscriptionPossiblyStored(DEPOSITOR, HASH_ID);
  console.log('Deposited by user:', stored);

  if (!stored) {
    console.log('Not found as user deposit. Trying emergencyWithdrawEthscription (owner only)...');
    const tx = await contract.emergencyWithdrawEthscription(HASH_ID);
    await tx.wait();
    console.log('TX:', tx.hash);
    console.log('Withdrawn to owner');
    return;
  }

  // Owner can't call cancelSwapDeposit on behalf of user
  // But owner CAN use emergencyWithdrawEthscription
  console.log('Using emergencyWithdrawEthscription...');
  const tx = await contract.emergencyWithdrawEthscription(HASH_ID);
  await tx.wait();
  console.log('TX:', tx.hash);
  console.log('Withdrawn to owner wallet');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
