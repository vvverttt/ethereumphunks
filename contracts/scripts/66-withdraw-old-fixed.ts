import hre from 'hardhat';

const PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

// OLD hashIds from C:\Users\alber\OneDrive\Desktop\market\withdraw\
const OLD_HASHIDS = [
  // missing-phunks-old.json
  '0xa4adf3034d941af7788711068f27187a7f2814215aea8370a951a5f77d665725', // #10004
  '0xb4dd2fcae58ac4c38e6ddc4c113490d665057aa7d1c7d5bdefa3d92b81583ba9', // #10015
  '0x7707668e833d40514b3972b017a87b48d95319606f3776e36d91afda361a5825', // #10058
  '0x5c3eb47681fc8966a59adaba4fd85b7cd06e3b643b34a876c71ee02d163dfd7f', // #10078
  '0x4ee9fcae83c10d7013aae58f683d173d2c05bcf19c42d922bc0d0d9b6069ee2f', // #10093
  '0x7da0e342f53af6941b1722a5dd7df4b3c37bb7d4f434a3234e928796976af4f4', // #10099
  '0xe1fd42dbc43925c092b7f41c66aa2916bedde4b4f035de82b301b55faf578a21', // #10207
  '0x5ff2e0c01469b8fa37ded5a22d08683b2e7477fc4b48118dfa6def29ac9254bb', // #10250
  // dystophunks-old.json
  '0x1dff838ac02192dbd456a209ad5b1aa7cbb8e0afcf2e091b436270ed02db78c8', // #10251
  '0x0596074cc07975d4bdd6d6ea9e4558db95b69e628ec410329c6fafdac7432ba4', // #10259
  '0x73594a81bb93f8a912c7173939eb417d09d64397c65f6074e322e8fd0a825fad', // #10261
  '0x472bb9154a2a798734cbd055a530efb73939fa45d97cc4ef6fe6d9ebb18a2b4f', // #10277
  '0x9b99836cb4fd4558d1112b53f10b80feb2a6e49eaf2efbd3bd58bc62186f14ad', // #10287
  '0x84c6cca1cd54bd3cd90f96ef329e7a91bb537a1209cdc55284fefa5f19f3d24c', // #10290
  '0x476f0c93ec52c4bacfb147974a48ed96e7e964fce46520bef7ed6326cba2cadf', // #10293
  '0x8c67c4e3721efe2e23efe57623aef3facc448e96a40853e2b80b560c57f0d4a8', // #10295
  '0xe08effaf3556b2f511246340c84cdf1e0947f896991d51e85ebd1b04d74b1e63', // #10298
  '0x7598ec4dd273fe2620c2b3be7d1a7313554deaca71432dc9a6634e9b19f130da', // #10299
  '0x91a2a43c4fb55a3919c42fab28011215e5031169b4502b6d82f6af840dc84441', // #10301
  '0x70a9b1f88c9a42e59470f17fe9bdabaf03bfe6cd9d4965c083cd0bfb4daf1ff5', // #10306
  '0x8094b0bd726e5c0b50607b36f0a0f7daea7c44c8c5e0ec8228760c670142c85b', // #10307
  '0x46c01d736e6881a5865959488ea7cd574a6c111e2ffb41fdec16efec9a6b6439', // #10308
  '0x820daea5a0aa206dbda20085a58083a570c388e8657bb2334bc12c017f8915b9', // #10312
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Signer:', signer.address);
  const contract = await hre.ethers.getContractAt('Mutation', PROXY_ADDRESS, signer);

  console.log(`\nWithdrawing ${OLD_HASHIDS.length} OLD hashIds with FIXED previousOwner...\n`);

  let success = 0, failed = 0;
  for (const hashId of OLD_HASHIDS) {
    try {
      const tx = await contract.withdrawEthscription(hashId as `0x${string}`, signer.address);
      const receipt = await tx.wait();
      console.log(`✅ ${hashId.slice(0, 18)}... tx=${receipt?.hash} status=${receipt?.status}`);
      success++;
    } catch (e: any) {
      console.error(`❌ ${hashId.slice(0, 18)}...: ${e.message?.slice(0, 100)}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
