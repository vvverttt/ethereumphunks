import { ethers } from 'hardhat';
async function main() {
  // EIP-1967 implementation slot
  const PROXY = '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A';
  const slot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
  const val = await ethers.provider.getStorage(PROXY, slot);
  const impl = '0x' + val.slice(26);
  console.log('Current impl:', impl);
}
main().catch(console.error);
