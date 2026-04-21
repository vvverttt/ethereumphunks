import { ethers } from 'hardhat';

const PROXY     = '0x9833b60234424e1DAAC8883D3F52c16093563BBF';
const VALIDATOR = '0x721C0078c2328597Ca70F5451ffF5A7B38D4E947';
const OUR_MARKET = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';
const BLUR       = '0x00000000000111AbE46ff893f3B2fdF1F759a8A8';
const OPENSEA    = '0x1E0049783F008A0085193E00003D00cd54003c71';
const RANDOM     = '0x000000000000000000000000000000000000dEaD';

const ABI = [
  'function isAccountWhitelistedByCollection(address collection, address account) external view returns (bool)',
  'function getCollectionSecurityPolicy(address collection) external view returns (tuple(uint8 transferSecurityLevel, uint120 listId) policy)',
];

async function main() {
  const v = await ethers.getContractAt(ABI, VALIDATOR);
  const policy = await v.getCollectionSecurityPolicy(PROXY);
  console.log('Security level:', policy.transferSecurityLevel.toString());
  console.log('List ID applied:', policy.listId.toString());
  console.log('');
  console.log('Our market whitelisted:', await v.isAccountWhitelistedByCollection(PROXY, OUR_MARKET));
  console.log('Blur whitelisted:      ', await v.isAccountWhitelistedByCollection(PROXY, BLUR));
  console.log('OpenSea whitelisted:   ', await v.isAccountWhitelistedByCollection(PROXY, OPENSEA));
  console.log('Random addr blocked:   ', !(await v.isAccountWhitelistedByCollection(PROXY, RANDOM)));
}

main().catch(err => { console.error(err); process.exit(1); });
