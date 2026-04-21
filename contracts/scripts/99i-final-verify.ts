import { ethers } from 'hardhat';

const PROXY      = '0x9833b60234424e1DAAC8883D3F52c16093563BBF';
const VALIDATOR  = '0x721C0078c2328597Ca70F5451ffF5A7B38D4E947';
const OUR_MARKET = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';
const BLUR       = '0x00000000000111AbE46ff893f3B2fdF1F759a8A8';
const RANDOM     = '0x000000000000000000000000000000000000dEaD';

// Correct 4-field tuple (v3 has 2 bools + uint8 + uint120, no 3rd bool)
const ABI = [
  'function getCollectionSecurityPolicy(address collection) external view returns (tuple(bool disableAuthorizationMode, bool authorizationModeAllowWildcardOperators, uint8 transferSecurityLevel, uint120 listId) policy)',
  'function isAccountWhitelistedByCollection(address collection, address account) external view returns (bool)',
  'function getWhitelistedAccountsByCollection(address collection) external view returns (address[])',
];

async function main() {
  const v = await ethers.getContractAt(ABI, VALIDATOR);

  const policy = await v.getCollectionSecurityPolicy(PROXY);
  console.log('── Collection Security Policy ────────────────────────────');
  console.log('Transfer security level:', policy.transferSecurityLevel.toString(), policy.transferSecurityLevel === 1n ? '(Whitelist enforced ✅)' : '');
  console.log('List ID applied:        ', policy.listId.toString());
  console.log('Disable auth mode:      ', policy.disableAuthorizationMode);

  console.log('\n── Whitelist ─────────────────────────────────────────────');
  console.log('Our market (0%): ', await v.isAccountWhitelistedByCollection(PROXY, OUR_MARKET));
  console.log('Blur:            ', await v.isAccountWhitelistedByCollection(PROXY, BLUR));
  console.log('Random blocked:  ', !(await v.isAccountWhitelistedByCollection(PROXY, RANDOM)));

  const wl = await v.getWhitelistedAccountsByCollection(PROXY);
  console.log('\nAll whitelisted addresses:');
  wl.forEach((addr: string) => console.log(' ', addr));
}

main().catch(err => { console.error(err); process.exit(1); });
