import hre, { upgrades } from 'hardhat';

const contractName = 'PhilipLotteryV67';

// ── Configure before deploying ──────────────────────────────
const _standardPlayPrice = hre.ethers.parseEther('0.00001');  // Standard tier
const _premiumPlayPrice  = hre.ethers.parseEther('0.167');    // Premium tier
const _pointsAddress     = '0x0493bdBC99d17fe5fD8BD21Fd03792BE66eA3E14'; // Points V2
const _treasuryAddress   = '0x19d57A31b982d3d75c16358795A4D19c803e4A72'; // Treasury
// ─────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function deploy() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log(`Deploying ${contractName} (both tiers) with account:`, signer.address);
  console.log('=====================================================================');

  // Wait 10 seconds in case we want to cancel
  await delay(10000);

  const ContractFactory = await hre.ethers.getContractFactory(contractName);

  // ── Standard tier ──────────────────────────────────────────
  console.log('\n--- Deploying STANDARD tier ---');
  const standard = await upgrades.deployProxy(
    ContractFactory,
    [_standardPlayPrice, _pointsAddress, _treasuryAddress],
    { initializer: 'initialize' }
  );
  await standard.waitForDeployment();

  const standardProxy = await standard.getAddress();
  const standardImpl  = await upgrades.erc1967.getImplementationAddress(standardProxy);
  const standardAdmin = await upgrades.erc1967.getAdminAddress(standardProxy);

  console.log(`  Proxy:          ${standardProxy}`);
  console.log(`  Implementation: ${standardImpl}`);
  console.log(`  ProxyAdmin:     ${standardAdmin}`);

  // ── Premium tier ───────────────────────────────────────────
  console.log('\n--- Deploying PREMIUM tier ---');
  const premium = await upgrades.deployProxy(
    ContractFactory,
    [_premiumPlayPrice, _pointsAddress, _treasuryAddress],
    { initializer: 'initialize' }
  );
  await premium.waitForDeployment();

  const premiumProxy = await premium.getAddress();
  const premiumImpl  = await upgrades.erc1967.getImplementationAddress(premiumProxy);
  const premiumAdmin = await upgrades.erc1967.getAdminAddress(premiumProxy);

  console.log(`  Proxy:          ${premiumProxy}`);
  console.log(`  Implementation: ${premiumImpl}`);
  console.log(`  ProxyAdmin:     ${premiumAdmin}`);

  // ── Summary ────────────────────────────────────────────────
  console.log('\n=====================================================================');
  console.log('SUMMARY:');
  console.log('');
  console.log('  STANDARD LOTTERY:');
  console.log(`    Proxy:          ${standardProxy}`);
  console.log(`    Implementation: ${standardImpl}`);
  console.log(`    ProxyAdmin:     ${standardAdmin}`);
  console.log(`    Play Price:     ${hre.ethers.formatEther(_standardPlayPrice)} ETH`);
  console.log('');
  console.log('  PREMIUM LOTTERY:');
  console.log(`    Proxy:          ${premiumProxy}`);
  console.log(`    Implementation: ${premiumImpl}`);
  console.log(`    ProxyAdmin:     ${premiumAdmin}`);
  console.log(`    Play Price:     ${hre.ethers.formatEther(_premiumPlayPrice)} ETH`);
  console.log('');
  console.log(`  Points:    ${_pointsAddress}`);
  console.log(`  Treasury:  ${_treasuryAddress}`);
  console.log('=====================================================================');
  console.log(`\nVerify: npx hardhat verify --network mainnet ${standardImpl}`);
  console.log(`        npx hardhat verify --network mainnet ${premiumImpl}`);
  console.log('\nNext steps:');
  console.log('  1. Verify implementation on Etherscan');
  console.log('  2. Grant POINTS_MANAGER_ROLE to both proxy addresses (script 37)');
  console.log('  3. Set play prices via setPrice() if different');
  console.log('  4. Deposit prizes via fallback (send ethscription hashes as calldata)');
  console.log('  5. Update lotteryAddress + lottery2Address in frontend env configs');
  console.log('=====================================================================\n');
}

deploy().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
