import { ethers } from 'hardhat';
async function main() {
  const c = await ethers.getContractAt(
    ['function collections(bytes32) view returns (uint8 collType, address contractAddress, uint256 pointValue, bool enabled, bool exists, bytes32 merkleRoot)'],
    '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A'
  );
  const v67 = ethers.keccak256(ethers.toUtf8Bytes('cryptophunksv67'));
  const result = await c.collections(v67);
  console.log('V67 merkleRoot:', result.merkleRoot);
  console.log('V67 enabled:', result.enabled);
}
main().catch(console.error);
