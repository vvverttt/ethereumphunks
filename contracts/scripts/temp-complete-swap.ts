import hre from 'hardhat';

const PROXY = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
const DEPOSITOR = '0x436196aB0550E73AEEdd1a494C2420DAcA7Fe0Ca';
const HASH_ID = '0x396236ea4c958d9d36e8a17ddb08f2d17c6b554b09c5d81e772957ef603004a0';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', PROXY);

  // Check deposit exists
  const stored = await contract.userEthscriptionPossiblyStored(DEPOSITOR, HASH_ID);
  console.log('Deposit exists:', stored);

  // Check eligibility
  const eligible = await contract.eligibleEthscription(HASH_ID);
  console.log('Eligible:', eligible);

  // Check pool
  const pool = await contract.poolSize();
  console.log('Pool size:', pool.toString());

  if (!stored) {
    console.log('\nDeposit not found! Cannot complete swap.');
    return;
  }

  if (!eligible) {
    console.log('\nNot eligible! Was it already used?');
    return;
  }

  console.log('\nDeposit is valid. The user needs to call swapEthscription() from their wallet.');
  console.log('Owner cannot call it on their behalf since it checks msg.sender.');
  console.log('\nThe user should call cancelSwapDeposit to get it back, or call swapEthscription from the UI.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
