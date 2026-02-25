import hre from 'hardhat';

const contractName = 'CarlStrategy';

// Forward address: receives the portion of revShare NOT kept in treasury
const _forwardAddress = '0xA392be17E79F7e9fc2Fb9689Ef6B1BfB033974c4';

// Treasury keeps 50% of incoming revShare (5000 bps = 50%)
// The other 50% is forwarded to _forwardAddress
const _treasuryBps = 5000;

export async function deployCarlStrategy() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log(`Deploying ${contractName} with account:`, signer.address);
  console.log('=====================================================================');

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const contract = await ContractFactory.deploy(_forwardAddress, _treasuryBps);

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log('\n=====================================================================');
  console.log('SUMMARY:');
  console.log(`  CarlStrategy:   ${address}`);
  console.log(`  Owner:          ${signer.address}`);
  console.log(`  Forward to:     ${_forwardAddress}`);
  console.log(`  Treasury keeps: ${_treasuryBps / 100}%`);
  console.log('=====================================================================');
  console.log(`\nVerify with: npx hardhat verify --network mainnet ${address} "${_forwardAddress}" "${_treasuryBps}"`);
  console.log('\nNext steps:');
  console.log(`  1. Verify on Etherscan`);
  console.log(`  2. Call setRevShareAddress("${address}") on Market proxy`);
  console.log('=====================================================================\n');
}

deployCarlStrategy().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
