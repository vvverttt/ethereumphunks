import hre from 'hardhat';

const PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

const TEST_5 = [
  '0xa4adf3034d941af7788711068f27187a7f2814215aea8370a951a5f77d665725', // #10004
  '0xb4dd2fcae58ac4c38e6ddc4c113490d665057aa7d1c7d5bdefa3d92b81583ba9', // #10015
  '0x7707668e833d40514b3972b017a87b48d95319606f3776e36d91afda361a5825', // #10058
  '0x5c3eb47681fc8966a59adaba4fd85b7cd06e3b643b34a876c71ee02d163dfd7f', // #10078
  '0x4ee9fcae83c10d7013aae58f683d173d2c05bcf19c42d922bc0d0d9b6069ee2f', // #10093
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Signer:', signer.address);
  const contract = await hre.ethers.getContractAt('Mutation', PROXY_ADDRESS, signer);

  for (const hashId of TEST_5) {
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
