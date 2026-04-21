import { ethers } from 'hardhat';

const PROXY      = '0x9833b60234424e1DAAC8883D3F52c16093563BBF';
const VALIDATOR  = '0x721C0078c2328597Ca70F5451ffF5A7B38D4E947';
const RANDOM     = '0x000000000000000000000000000000000000dEaD';
const OUR_MARKET = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

const ABI = [
  // 3-param version — no tokenId required
  'function validateTransfer(address caller, address from, address to) external view',
  'function isAccountWhitelistedByCollection(address collection, address account) external view returns (bool)',
];

async function main() {
  const [signer] = await ethers.getSigners();
  const v = new ethers.Contract(VALIDATOR, ABI, signer);

  console.log('── Whitelist check ───────────────────────────────────────');
  console.log('Our market whitelisted:', await v.isAccountWhitelistedByCollection(PROXY, OUR_MARKET));
  console.log('Blur whitelisted:      ', await v.isAccountWhitelistedByCollection(PROXY, '0x00000000000111AbE46ff893f3B2fdF1F759a8A8'));
  console.log('Random whitelisted:    ', await v.isAccountWhitelistedByCollection(PROXY, RANDOM));

  console.log('\n── Transfer validation (3-param, no tokenId) ─────────────');

  console.log('Random as caller (should BLOCK):');
  try {
    await v.validateTransfer.staticCall(RANDOM, signer.address, signer.address);
    console.log('  → ALLOWED (enforcement off)');
  } catch {
    console.log('  → BLOCKED ✅');
  }

  console.log('Our market as caller (should ALLOW):');
  try {
    await v.validateTransfer.staticCall(OUR_MARKET, signer.address, signer.address);
    console.log('  → ALLOWED ✅');
  } catch {
    console.log('  → BLOCKED ❌ (market not enforcing correctly)');
  }

  console.log('address(0) caller / direct transfer (should ALLOW):');
  try {
    await v.validateTransfer.staticCall(ethers.ZeroAddress, signer.address, signer.address);
    console.log('  → ALLOWED ✅');
  } catch {
    console.log('  → BLOCKED ❌');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
