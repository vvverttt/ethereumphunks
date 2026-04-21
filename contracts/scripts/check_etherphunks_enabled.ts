import { ethers } from 'hardhat';
async function main() {
  const c = await ethers.getContractAt(
    ['function collections(bytes32) view returns (uint8 collType, address contractAddress, bytes32 merkleRoot, uint256 pointValue, bool enabled, bool exists)'],
    '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A'
  );
  const slug = ethers.keccak256(ethers.toUtf8Bytes('etherphunks'));
  const result = await c.collections(slug);
  console.log('enabled:', result.enabled);
  console.log('exists:', result.exists);
}
main().catch(console.error);
