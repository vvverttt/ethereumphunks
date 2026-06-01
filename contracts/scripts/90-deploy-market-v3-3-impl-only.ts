/**
 * Deploy EtherPhunksMarketV3_3 IMPLEMENTATION ONLY.
 *
 * V3_3 adds a DEPOSIT_AND_ACCEPT_BID fallback path so the owner can escrow the
 * Ethscription AND accept a standing bid in a SINGLE transaction (true 3-step
 * bid flow). Storage layout is identical to V3_2 (no new state — only a new
 * constant + an overridden fallback + an internal helper), so it's strictly
 * upgrade-safe.
 *
 * Key-separation flow (no production key on disk):
 *   1. Fund a throwaway deployer, set MAINNET_PK / MAINNET_ADDRESS to it.
 *   2. npx hardhat run scripts/90-deploy-market-v3-3-impl-only.ts --network mainnet
 *   3. quantumphunks.eth signs `upgradeAndCall` / `upgrade` on the ProxyAdmin
 *      via Etherscan (data = 0x — no re-init).
 */

import hre, { upgrades } from 'hardhat';

const MARKET_PROXY = '0xa48a43186612B179C0bc68Ea34B4932549a70BfA';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address);
  console.log('Network: ', hre.network.name);

  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Balance: ', hre.ethers.formatEther(bal), 'ETH');
  if (bal === 0n) throw new Error('Deployer has 0 ETH — fund first.');

  const Factory = await hre.ethers.getContractFactory('EtherPhunksMarketV3_3');

  // 0. Import proxy into OZ manifest if not already there. The currently
  //    deployed implementation is V3_2 — import using that as the baseline.
  console.log('\nChecking OZ manifest for proxy', MARKET_PROXY);
  try {
    const V32 = await hre.ethers.getContractFactory('EtherPhunksMarketV3_2');
    await upgrades.forceImport(MARKET_PROXY, V32, { kind: 'transparent' });
    console.log('✓ Imported as V3_2 baseline');
  } catch (e: any) {
    if (!String(e.message || '').includes('already')) {
      console.log('  (forceImport note:', e.message?.slice(0, 100) || e, ')');
    } else {
      console.log('✓ Already in manifest');
    }
  }

  // 1. Storage-layout validation V3_2 → V3_3
  console.log('\nValidating storage layout V3_2 → V3_3...');
  await upgrades.validateUpgrade(MARKET_PROXY, Factory, { kind: 'transparent' });
  console.log('✓ Storage layout safe');

  // 2. Deploy new impl (proxy mutation is quantumphunks.eth's job on Etherscan)
  console.log('\nDeploying V3_3 implementation...');
  const newImpl = await upgrades.prepareUpgrade(MARKET_PROXY, Factory, {
    kind: 'transparent',
  }) as string;
  console.log('✓ New impl deployed at:', newImpl);

  const proxyAdmin = await upgrades.erc1967.getAdminAddress(MARKET_PROXY);
  console.log('ProxyAdmin:', proxyAdmin);

  console.log('\n─── Next: quantumphunks.eth signs on Etherscan ──────────');
  console.log(`  https://etherscan.io/address/${proxyAdmin}#writeContract`);
  console.log('  Call: upgradeAndCall(proxy, implementation, data)');
  console.log(`    proxy:          ${MARKET_PROXY}`);
  console.log(`    implementation: ${newImpl}`);
  console.log('    data:           0x   (no re-init)');
  console.log('');
  console.log('─── Verify on Etherscan ─────────────────────────────────');
  console.log(`  npx hardhat verify --network mainnet ${newImpl} \\`);
  console.log(`    --contract contracts/V2MainnetUpgrade/EtherPhunksMarketV3_3.sol:EtherPhunksMarketV3_3`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
