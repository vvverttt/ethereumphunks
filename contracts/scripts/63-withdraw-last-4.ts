import hre from 'hardhat';

const PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

const LAST_4 = [
  '0xd74cec8aeba3b4d3d5944678e14a5225f1f58dca2df2d22f7d56e691faca80e2', // #10306
  '0x544b706aaf19afd73b8dabaca03fbd4e80de98ab7f0865d6c5a8317da3cbbda3', // #10307
  '0xd61c2419d8947a60a624924711d6f0ef361aed551326370f96fe5facd4c7b766', // #10308
  '0x0d2594fa174377c84f219237498968a45df3e6e59e205970a6439eb670a23043', // #10312
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Signer:', signer.address);
  const contract = await hre.ethers.getContractAt('Mutation', PROXY_ADDRESS, signer);

  for (const hashId of LAST_4) {
    try {
      const tx = await contract.withdrawEthscription(hashId as `0x${string}`, signer.address);
      const receipt = await tx.wait();
      console.log(`✅ ${hashId.slice(0, 18)}... tx=${receipt?.hash} status=${receipt?.status}`);
    } catch (e: any) {
      console.error(`❌ ${hashId.slice(0, 18)}...: ${e.message?.slice(0, 100)}`);
    }
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
