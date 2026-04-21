import { ethers, upgrades } from 'hardhat';

const PROXY     = '0x9833b60234424e1DAAC8883D3F52c16093563BBF';
// Limit Break TransferValidator v3 — enforces royalties on Blur, OpenSea, etc.
const VALIDATOR = '0x721C0078c2328597Ca70F5451ffF5A7B38D4E947';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Upgrader:', deployer.address);

  const Factory = await ethers.getContractFactory('ERC721PhunksV67');

  // 1. Deploy new implementation + upgrade proxy
  console.log('\nUpgrading proxy...');
  const upgraded = await upgrades.upgradeProxy(PROXY, Factory, {
    // Storage layout check — verifies we only appended slots
    unsafeAllowLinkedLibraries: false,
  });
  await upgraded.waitForDeployment();

  const newImpl = await upgrades.erc1967.getImplementationAddress(PROXY);
  console.log('✅  Proxy:       ', PROXY);
  console.log('✅  New impl:    ', newImpl);

  // 2. Enable ERC721-C by pointing to the Limit Break TransferValidator
  console.log('\nSetting transfer validator...');
  const contract = await ethers.getContractAt('ERC721PhunksV67', PROXY);
  const tx = await contract.setTransferValidator(VALIDATOR);
  await tx.wait();
  console.log('✅  TransferValidator set:', VALIDATOR);

  console.log('\n── Next steps ──────────────────────────────────────────────');
  console.log('Configure royalty enforcement level via the validator contract');
  console.log('Validator:', VALIDATOR);
  console.log('Call: applyListToCollection(address collection, uint120 listId)');
  console.log('  listId 0 = no restrictions, 1 = Limit Break default allowlist');
  console.log('Or use: https://limit.break.io/  to configure via UI');
}

main().catch(err => { console.error(err); process.exit(1); });
