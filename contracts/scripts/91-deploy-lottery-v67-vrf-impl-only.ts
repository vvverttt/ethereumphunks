/**
 * Deploy PhilipLotteryV67_VRF IMPLEMENTATION ONLY.
 *
 * Upgrade target for BOTH live lottery proxies (normal + pro), which currently
 * run PhilipLotteryV67 (commit-reveal — vulnerable to cherry-picking). V67_VRF
 * preserves V67's EXACT storage layout (commit-reveal vars kept as reserved-
 * for-layout) and consumes gap slots for Chainlink VRF v2.5 state. The VRF flow
 * is single-tx (pay → VRF → assign), with no cancel/reveal — cherry-pick gone.
 *
 * One impl serves both proxies (they share an impl today).
 *
 * Key-separation flow (no production key on disk):
 *   1. Fund a throwaway deployer; set MAINNET_PK / MAINNET_ADDRESS to it.
 *   2. npx hardhat run scripts/91-deploy-lottery-v67-vrf-impl-only.ts --network mainnet
 *   3. quantumphunks.eth signs `upgradeAndCall(proxy, impl, 0x)` on EACH
 *      proxy's ProxyAdmin via Etherscan.
 *   4. quantumphunks.eth calls setVRFConfig(wrapper, callbackGasLimit, conf)
 *      on EACH proxy.
 */

import hre, { upgrades } from 'hardhat';

const NORMAL = '0x29b0d38112e8e743b63EB463F3351ab0F1E15977';
const PRO    = '0x298771ECc338DE242ADa11e49E2B8224c33bf620';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deployer:', deployer.address, '| network:', hre.network.name);
  const bal = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Balance: ', hre.ethers.formatEther(bal), 'ETH');
  if (bal === 0n) throw new Error('Deployer has 0 ETH — fund first.');

  const V67 = await hre.ethers.getContractFactory('PhilipLotteryV67');
  const VRF = await hre.ethers.getContractFactory('PhilipLotteryV67_VRF');

  // Import + validate BOTH proxies before deploying anything.
  for (const [name, proxy] of [['normal', NORMAL], ['pro', PRO]] as const) {
    console.log(`\nValidating ${name} (${proxy})...`);
    try {
      await upgrades.forceImport(proxy, V67, { kind: 'transparent' });
    } catch (e: any) {
      if (!String(e.message || '').includes('already')) console.log('  import note:', e.message?.slice(0, 80));
    }
    await upgrades.validateUpgrade(proxy, VRF, { kind: 'transparent' });
    console.log('  ✓ storage layout V67 → V67_VRF safe');
  }

  // Deploy ONE impl (both proxies will point to it).
  console.log('\nDeploying V67_VRF implementation...');
  const impl = await upgrades.prepareUpgrade(NORMAL, VRF, { kind: 'transparent' }) as string;
  console.log('✓ New impl:', impl);

  for (const [name, proxy] of [['normal', NORMAL], ['pro', PRO]] as const) {
    const admin = await upgrades.erc1967.getAdminAddress(proxy);
    console.log(`\n─── ${name} upgrade (quantumphunks.eth signs) ───`);
    console.log(`  ProxyAdmin: https://etherscan.io/address/${admin}#writeContract`);
    console.log(`  upgradeAndCall(proxy=${proxy}, implementation=${impl}, data=0x)`);
  }

  console.log('\n─── After both upgrades land: setVRFConfig on EACH proxy ───');
  console.log('  setVRFConfig(vrfWrapper, callbackGasLimit=500000, requestConfirmations=3)');
  console.log('  vrfWrapper = <MAINNET Chainlink VRF v2.5 Wrapper address — confirm from Chainlink docs>');
  console.log('\n─── Verify ───');
  console.log(`  npx hardhat verify --network mainnet ${impl} --contract contracts/V2MainnetUpgrade/PhilipLotteryV67_VRF.sol:PhilipLotteryV67_VRF`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
