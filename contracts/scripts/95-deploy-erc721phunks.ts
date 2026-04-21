import { ethers, upgrades } from 'hardhat';

// ─────────────────────────────────────────────────────────────────────────────
//  Deploy ERC721PhunksV1 behind a UUPS proxy.
//
//  Requires viaIR: true in hardhat.config.ts (contract uses it to avoid
//  "stack too deep" in the on-chain SVG builder).
//
//  Usage:
//    npx hardhat run scripts/95-deploy-erc721phunks.ts --network mainnet
//
//  Set these before running:
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  name:        'QuantumPhunks',
  symbol:      'QPHUNK',
  treasury:    '0x8191f333Da8fEB4De8Ec0d929b136297FDAA34de', // donationsAddress — receives royalties
  merkleRoot:  '0x' + '0'.repeat(64),       // replace with actual root before minting
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH');

  const Factory = await ethers.getContractFactory('ERC721PhunksV67');

  const proxy = await upgrades.deployProxy(
    Factory,
    [CONFIG.name, CONFIG.symbol, CONFIG.treasury, CONFIG.merkleRoot],
    { kind: 'uups', initializer: 'initialize' }
  );

  await proxy.waitForDeployment();
  const proxyAddress  = await proxy.getAddress();
  const implAddress   = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log('\n✅  Proxy deployed:      ', proxyAddress);
  console.log('✅  Implementation:      ', implAddress);
  console.log('\nAdd to environment.ts:');
  console.log(`  erc721PhunksAddress: '${proxyAddress}' as \`0x\${string}\``);
}

main().catch(err => { console.error(err); process.exit(1); });
