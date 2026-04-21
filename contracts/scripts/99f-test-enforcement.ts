import { ethers } from 'hardhat';

const PROXY     = '0x9833b60234424e1DAAC8883D3F52c16093563BBF';
const VALIDATOR = '0x721C0078c2328597Ca70F5451ffF5A7B38D4E947';
const RANDOM    = '0x000000000000000000000000000000000000dEaD';
const OUR_MARKET = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

const ABI = [
  'function validateTransfer(address caller, address from, address to, uint256 tokenId) external',
  'function getCollectionSecurityPolicy(address collection) external view returns (tuple(uint8 transferSecurityLevel, uint120 listId) policy)',
];

async function main() {
  const [signer] = await ethers.getSigners();
  const v = new ethers.Contract(VALIDATOR, ABI, signer);

  // Test 1: random unlisted operator — should revert if enforcement is active
  console.log('Testing random operator (should be BLOCKED if level>0):');
  try {
    await v.validateTransfer.staticCall(RANDOM, signer.address, signer.address, 1);
    console.log('  → ALLOWED (level is 0, no enforcement yet)');
  } catch (e: any) {
    console.log('  → BLOCKED ✅', e.message?.slice(0, 80));
  }

  // Test 2: our market — should always be allowed
  console.log('\nTesting our market (should be ALLOWED):');
  try {
    await v.validateTransfer.staticCall(OUR_MARKET, signer.address, signer.address, 1);
    console.log('  → ALLOWED ✅');
  } catch (e: any) {
    console.log('  → BLOCKED ❌', e.message?.slice(0, 80));
  }

  // Raw policy read
  const raw = await (new ethers.Contract(VALIDATOR, [
    'function getCollectionSecurityPolicy(address) external view returns (uint256)',
  ], signer)).getCollectionSecurityPolicy(PROXY);
  console.log('\nRaw packed policy uint256:', raw.toString(), '(hex:', raw.toString(16), ')');
}

main().catch(err => { console.error(err); process.exit(1); });
