import { ethers } from 'hardhat';
async function main() {
  const [signer] = await ethers.getSigners();
  const PROXY = '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A';
  const v67Slug = ethers.keccak256(ethers.toUtf8Bytes('cryptophunksv67'));
  // Use a dummy hashId just to test the fallback accepts the call
  const dummyHash = '0x0000000000000000000000000000000000000000000000000000000000000001';
  const data = v67Slug + dummyHash.slice(2);
  console.log('Signer:', signer.address);
  console.log('Data length:', data.length, '(should be 130 = 0x + 128 hex chars)');
  try {
    await signer.provider!.call({ to: PROXY, data, from: signer.address });
    console.log('Fallback call succeeded');
  } catch (e: any) {
    console.log('Fallback call failed:', e.message);
  }
}
main().catch(console.error);
