import hre, { upgrades } from 'hardhat';

const contractName = 'EtherPhunksMarketV2_1';
const _proxyAddress = '0x10e137E267dCB5774e42251c32305F457a6aE5Ec';

export async function upgradeMarket() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n\n=====================================================================');
  console.log(`Upgrading marketplace to ${contractName} (try/catch fix)`);
  console.log(`  Proxy:   ${_proxyAddress}`);
  console.log(`  Account: ${signer.address}`);
  console.log('=====================================================================');

  // Wait 10 seconds in case we want to cancel
  await delay(10000);

  // Get the contract factory
  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  // Upgrade the proxy (no initialization needed, just the _addPoints fix)
  const contract = await upgrades.upgradeProxy(
    _proxyAddress,
    ContractFactory,
  );
  await contract.waitForDeployment();

  const upgraded = await contract.getAddress();

  console.log('\n=====================================================================');
  console.log('SUMMARY:');
  console.log(`  ${contractName} upgraded at proxy: ${upgraded}`);
  console.log('=====================================================================');
  console.log(`\nVerify with: npx hardhat verify --network mainnet ${upgraded}`);
  console.log('\nFix applied:');
  console.log('  _addPoints now uses try/catch — points contract issues won\'t brick buys');
  console.log('\nNext steps:');
  console.log('  1. Verify on Etherscan');
  console.log('  2. Call setPointsAddress(newPointsAddr) to point to new Points contract');
  console.log('=====================================================================\n');
}

upgradeMarket().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error({error});
  process.exit(1);
});

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}
