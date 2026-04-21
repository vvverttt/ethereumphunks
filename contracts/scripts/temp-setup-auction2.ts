import hre from 'hardhat';

const AUCTION2 = '0x2132622FF3178EF2574aF25D8EFdf94D6b7cc630';
const PROXY_ADMIN = '0x4a00C37781939ea4E1B38a19A12819270ea36A0a';
const NEW_OWNER = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

async function main() {
  const auction = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION2);
  const proxyAdmin = await hre.ethers.getContractAt(
    [{ inputs: [{ name: 'newOwner', type: 'address' }], name: 'transferOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' }],
    PROXY_ADMIN
  );

  console.log('1. Transferring contract ownership...');
  const tx1 = await auction.transferOwnership(NEW_OWNER);
  await tx1.wait();
  console.log('   TX:', tx1.hash);

  console.log('2. Transferring proxy admin...');
  const tx2 = await proxyAdmin.transferOwnership(NEW_OWNER);
  await tx2.wait();
  console.log('   TX:', tx2.hash);

  console.log('\nDone. All transferred to', NEW_OWNER);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
