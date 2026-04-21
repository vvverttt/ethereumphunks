import { ethers } from 'hardhat';

const PROXY     = '0x9833b60234424e1DAAC8883D3F52c16093563BBF';
const VALIDATOR = '0x721C0078c2328597Ca70F5451ffF5A7B38D4E947';

const ABI = [
  'function setTransferSecurityLevelOfCollection(address collection, uint8 level, bool disableAuthorizationMode, bool disableWildcardOperators, bool enableAccountFreezingMode) external',
  'function getCollectionSecurityPolicy(address collection) external view returns (uint8,uint8,uint120)',
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const validator = new ethers.Contract(VALIDATOR, ABI, deployer);

  const tx = await validator.setTransferSecurityLevelOfCollection(
    ethers.getAddress(PROXY),
    1,     // level 1 — whitelist required + OTC allowed
    false, // disableAuthorizationMode
    false, // disableWildcardOperators
    false, // enableAccountFreezingMode
  );
  console.log('tx hash:', tx.hash);
  await tx.wait();
  console.log('✅  Security level 1 set');

  const policy = await validator.getCollectionSecurityPolicy(PROXY);
  console.log('Policy:', policy);
}

main().catch(err => { console.error(err); process.exit(1); });
