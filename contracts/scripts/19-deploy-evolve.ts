import hre, { upgrades } from 'hardhat';

const contractName = 'Mutation';

// 0.0001 ETH = 100000000000000 wei
const _evolveFee = '100000000000000';

export async function deployEvolve() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log(`Deploying ${contractName} with account:`, signer.address);
  console.log(`  Evolve fee: ${_evolveFee} wei (0.0001 ETH)`);
  console.log('=====================================================================');

  // Wait 10 seconds in case we want to cancel
  await delay(10000);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);
  const contract = await upgrades.deployProxy(
    ContractFactory,
    [_evolveFee],
    { initializer: 'initialize' }
  );

  await contract.waitForDeployment();
  const proxyAddress = await contract.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);

  console.log('\n=====================================================================');
  console.log('SUMMARY:');
  console.log(`  Proxy:          ${proxyAddress}`);
  console.log(`  Implementation: ${implAddress}`);
  console.log(`  ProxyAdmin:     ${adminAddress}`);
  console.log(`  Owner:          ${signer.address}`);
  console.log(`  Evolve Fee:     ${_evolveFee} wei`);
  console.log('=====================================================================');
  console.log('\nNext steps:');
  console.log('  1. Verify implementation on Etherscan');
  console.log('  2. Run 20-register-evolve-pairs.ts to register OG↔Quantum pairs');
  console.log('  3. Send quantum ethscriptions to the proxy address');
  console.log('  4. Update frontend evolveAddress in environment configs');
  console.log('  5. Update indexer EVOLVE_ADDRESS_MAINNET env var');
  console.log('  6. Unpause contract when ready');
  console.log('=====================================================================\n');
}

deployEvolve().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
