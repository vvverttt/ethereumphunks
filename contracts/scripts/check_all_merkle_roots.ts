import { ethers } from 'hardhat';
async function main() {
  const c = await ethers.getContractAt(
    ['function collections(bytes32) view returns (uint8 collType, address contractAddress, uint256 pointValue, bool enabled, bool exists, bytes32 merkleRoot)'],
    '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A'
  );
  const slugs: Record<string, string> = {
    'cryptophunksv67': 'cryptophunksv67',
    'missingphunks': 'missingphunks',
    'dystophunks': 'dystophunks',
    'ethsrocks': 'ethsrocks',
    'ethereumphunks': 'ethereumphunks',
    'philipintern': 'philipintern',
    'v1phunks': 'v1phunks',
    'v2phunks': 'v2phunks',
  };
  for (const [name, slug] of Object.entries(slugs)) {
    const result = await c.collections(ethers.keccak256(ethers.toUtf8Bytes(slug)));
    console.log(name, '→', result.merkleRoot);
  }
}
main().catch(console.error);
