import hre from 'hardhat';

const VAULT = '0xB69d359Eaf0db03372a587d9dB6f75B0A92CB218';
const PROXY_ADMIN = '0x1B9e28ADC91f46256eDa055eAC743fda343A978e';
const MERKLE_ROOT = '0xc52b5af6c3681ccad3e954fdb73af906f5e36ee3c4af8c88bb8f1b176e922ba6';
const NEW_OWNER = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

async function main() {
  const vault = await hre.ethers.getContractAt('CryptoPhunksVault', VAULT);
  const proxyAdmin = await hre.ethers.getContractAt(
    [{ inputs: [{ name: 'newOwner', type: 'address' }], name: 'transferOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' }],
    PROXY_ADMIN
  );

  // 1. Set Merkle root
  console.log('1. Setting Merkle root...');
  const tx1 = await vault.setMerkleRoot(MERKLE_ROOT);
  await tx1.wait();
  console.log('   TX:', tx1.hash);
  console.log('   Root:', await vault.merkleRoot());

  // 2. Transfer contract ownership
  console.log('2. Transferring contract ownership...');
  const tx2 = await vault.transferOwnership(NEW_OWNER);
  await tx2.wait();
  console.log('   TX:', tx2.hash);
  console.log('   Owner:', await vault.owner());

  // 3. Transfer proxy admin
  console.log('3. Transferring proxy admin...');
  const tx3 = await proxyAdmin.transferOwnership(NEW_OWNER);
  await tx3.wait();
  console.log('   TX:', tx3.hash);

  console.log('\nDone. All set and transferred to', NEW_OWNER);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
