import { ethers } from 'hardhat';

const PROXY     = '0x9833b60234424e1DAAC8883D3F52c16093563BBF';
const VALIDATOR = '0x721C0078c2328597Ca70F5451ffF5A7B38D4E947';

// Our market = 0% royalty (whitelisted so validator passes it through)
const OUR_MARKET = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

// Major royalty-enforcing marketplace operators (pay 6.7% via ERC2981)
// These are the *royalty-enabled* operator addresses — NOT the "skip royalties" ones
const ROYALTY_OPERATORS = [
  '0x1E0049783F008A0085193E00003D00cd54003c71', // OpenSea Seaport 1.5 conduit (royalty mode)
  '0x00000000000111AbE46ff893f3B2fdF1F759a8A8', // Blur exchange v1
  '0x0000000000c2d145a2526bD8C716263bFeBe1A72', // Blur v2
];

const VALIDATOR_ABI = [
  'function createList(string calldata name) external returns (uint120)',
  'function addAccountsToWhitelist(uint120 id, address[] calldata accounts) external',
  'function applyListToCollection(address collection, uint120 id) external',
  // level, disableAuthorizationMode, disableWildcardOperators, enableAccountFreezingMode
  'function setTransferSecurityLevelOfCollection(address collection, uint8 level, bool disableAuthorizationMode, bool disableWildcardOperators, bool enableAccountFreezingMode) external',
  'function setTokenTypeOfCollection(address collection, uint16 tokenType) external',
  'function lastListId() external view returns (uint120)',
  'function getCollectionSecurityPolicy(address collection) external view returns (uint8,uint120)',
];

// TransferSecurityLevels: 0=None, 1=Whitelist+OTC enabled, 2=Whitelist only
const SECURITY_LEVEL_ONE = 1; // whitelisted operators only; direct owner→owner OTC still works
// ERC721 token type = 1
const TOKEN_TYPE_ERC721 = 1;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Caller:', deployer.address);

  const validator = new ethers.Contract(VALIDATOR, VALIDATOR_ABI, deployer);

  // List 27 was already created in a prior run — skip creation
  const listId = 27n;

  // 2. Add our market (0% royalty exempt) + known royalty-paying marketplace operators
  const allAddresses = [OUR_MARKET, ...ROYALTY_OPERATORS].map(a => ethers.getAddress(a));
  console.log('\nAdding addresses to whitelist...');
  console.log('  Our market (0% royalty):', OUR_MARKET);
  console.log('  Marketplace operators:', ROYALTY_OPERATORS.length);
  const addTx = await validator.addAccountsToWhitelist(listId, allAddresses);
  await addTx.wait();
  console.log('✅  Addresses added');

  // 3. Apply this list to the collection
  console.log('\nApplying list to collection...');
  const applyTx = await validator.applyListToCollection(PROXY, listId);
  await applyTx.wait();
  console.log('✅  List applied to', PROXY);

  // 4. Set security level 1 — only whitelisted operators can get approvals/transfer
  //    OTC (direct owner → owner transfer) still works without whitelist
  console.log('\nSetting security level 1 (whitelist + OTC)...');
  const levelTx = await validator.setTransferSecurityLevelOfCollection(
    PROXY,
    SECURITY_LEVEL_ONE,
    false, // disableAuthorizationMode
    false, // disableWildcardOperators
    false, // enableAccountFreezingMode
  );
  await levelTx.wait();
  console.log('✅  Security level 1 set');

  console.log('\n── Result ──────────────────────────────────────────────────');
  console.log('Our market (0x19d57...)  → whitelisted → 0% royalty');
  console.log('OpenSea / Blur           → whitelisted → must pay 6.7% via ERC2981');
  console.log('Any unlisted operator    → BLOCKED (transfer reverts)');
  console.log('Direct wallet transfer   → always works (OTC)');
}

main().catch(err => { console.error(err); process.exit(1); });
