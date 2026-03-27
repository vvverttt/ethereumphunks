import hre from 'hardhat';

const PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

// old hashId → new hashId (from authoritative JSONs)
const ALL_UPDATES: { tokenId: number; oldHashId: string; newHashId: string }[] = [
  // Quantum Missing Phunks (8)
  { tokenId: 10004, oldHashId: '0xa4adf3034d941af7788711068f27187a7f2814215aea8370a951a5f77d665725', newHashId: '0xa62831366cceaf8e3a8c528696ec9b5d36685bfa7d54afffdc08f3a812fbe87c' },
  { tokenId: 10015, oldHashId: '0xb4dd2fcae58ac4c38e6ddc4c113490d665057aa7d1c7d5bdefa3d92b81583ba9', newHashId: '0xc13c9446b70ed7b40b2f379305c0587a669b36cd44c97f51fcaa1bbad6f41a2b' },
  { tokenId: 10058, oldHashId: '0x7707668e833d40514b3972b017a87b48d95319606f3776e36d91afda361a5825', newHashId: '0x872d06f01dedd8c820dc136c2d817e24b623a70526a1c8acd5c923239ef31646' },
  { tokenId: 10078, oldHashId: '0x5c3eb47681fc8966a59adaba4fd85b7cd06e3b643b34a876c71ee02d163dfd7f', newHashId: '0x632f46a2880e85c86eadb867c76262a7c5df4cc0763d4fc851dd542f82b326ab' },
  { tokenId: 10093, oldHashId: '0x4ee9fcae83c10d7013aae58f683d173d2c05bcf19c42d922bc0d0d9b6069ee2f', newHashId: '0x10aef8ca7bbb020e62204b273f958b3f0a6c524ee9ccf24a7ea8163b23b6e4a6' },
  { tokenId: 10099, oldHashId: '0x7da0e342f53af6941b1722a5dd7df4b3c37bb7d4f434a3234e928796976af4f4', newHashId: '0xad6f4303eb6b70301da8fd3e261bd9943878c609603af98c8027c7956e08d6f1' },
  { tokenId: 10207, oldHashId: '0xe1fd42dbc43925c092b7f41c66aa2916bedde4b4f035de82b301b55faf578a21', newHashId: '0x31b478578539e973101ad77db1e4556ebb46b298f36c4f170a5b37d093d79d32' },
  { tokenId: 10250, oldHashId: '0x5ff2e0c01469b8fa37ded5a22d08683b2e7477fc4b48118dfa6def29ac9254bb', newHashId: '0x8b44334a95310db60e84bdcfe8332330623746dccffc915ab0011e7a309823aa' },
  // Quantum DystoPhunks (15)
  { tokenId: 10251, oldHashId: '0x1dff838ac02192dbd456a209ad5b1aa7cbb8e0afcf2e091b436270ed02db78c8', newHashId: '0x413f30c0b85bd3a787b40a8b4152fa3a40c1362525a0ad4620eecaf098ba67e4' },
  { tokenId: 10259, oldHashId: '0x0596074cc07975d4bdd6d6ea9e4558db95b69e628ec410329c6fafdac7432ba4', newHashId: '0x3439136078e5d3cbf059a9d66088100d6efea41f845e4f1949c705915b2a8225' },
  { tokenId: 10261, oldHashId: '0x73594a81bb93f8a912c7173939eb417d09d64397c65f6074e322e8fd0a825fad', newHashId: '0x92778fcc6975840b06c7d843b84e0ae3af2bef4d1fb0c208f1fcb4c309668b90' },
  { tokenId: 10277, oldHashId: '0x472bb9154a2a798734cbd055a530efb73939fa45d97cc4ef6fe6d9ebb18a2b4f', newHashId: '0xbcb6fc2e03fb9cb8ff6b92420d1efeeee96c172a346488fe21413c1cabe90a35' },
  { tokenId: 10287, oldHashId: '0x9b99836cb4fd4558d1112b53f10b80feb2a6e49eaf2efbd3bd58bc62186f14ad', newHashId: '0xbddf579de6472ae8eed7a435ca395111ea86cd51de80aa653efa44bb24120285' },
  { tokenId: 10290, oldHashId: '0x84c6cca1cd54bd3cd90f96ef329e7a91bb537a1209cdc55284fefa5f19f3d24c', newHashId: '0xec86ed520cda11af33aff0bf8d977510f0ff850819828895133910e6fa7dbe69' },
  { tokenId: 10293, oldHashId: '0x476f0c93ec52c4bacfb147974a48ed96e7e964fce46520bef7ed6326cba2cadf', newHashId: '0xaa04d65f69d28e1b724f0b715fd7dea5cb802b292f2390de154dea5d843e2377' },
  { tokenId: 10295, oldHashId: '0x8c67c4e3721efe2e23efe57623aef3facc448e96a40853e2b80b560c57f0d4a8', newHashId: '0xb9f56a93e45b4fccfb7109dcab2d76c5df67d64aac4a5a2af2a6dde707aba25f' },
  { tokenId: 10298, oldHashId: '0xe08effaf3556b2f511246340c84cdf1e0947f896991d51e85ebd1b04d74b1e63', newHashId: '0x0b1d7d2bdb9896a75bdc70ee1489e012b79cbe84b30e982c6f54c92f8d70eaad' },
  { tokenId: 10299, oldHashId: '0x7598ec4dd273fe2620c2b3be7d1a7313554deaca71432dc9a6634e9b19f130da', newHashId: '0x2cd4dafac8cc7755b9579575b8a0ce7e04faee52d83c1964ddaa47f06e991613' },
  { tokenId: 10301, oldHashId: '0x91a2a43c4fb55a3919c42fab28011215e5031169b4502b6d82f6af840dc84441', newHashId: '0xfaac0f1d76b283db7542e7877984ae1580dc4f721def628915f7f7c592298614' },
  { tokenId: 10306, oldHashId: '0x70a9b1f88c9a42e59470f17fe9bdabaf03bfe6cd9d4965c083cd0bfb4daf1ff5', newHashId: '0xd74cec8aeba3b4d3d5944678e14a5225f1f58dca2df2d22f7d56e691faca80e2' },
  { tokenId: 10307, oldHashId: '0x8094b0bd726e5c0b50607b36f0a0f7daea7c44c8c5e0ec8228760c670142c85b', newHashId: '0x544b706aaf19afd73b8dabaca03fbd4e80de98ab7f0865d6c5a8317da3cbbda3' },
  { tokenId: 10308, oldHashId: '0x46c01d736e6881a5865959488ea7cd574a6c111e2ffb41fdec16efec9a6b6439', newHashId: '0xd61c2419d8947a60a624924711d6f0ef361aed551326370f96fe5facd4c7b766' },
  { tokenId: 10312, oldHashId: '0x820daea5a0aa206dbda20085a58083a570c388e8657bb2334bc12c017f8915b9', newHashId: '0x0d2594fa174377c84f219237498968a45df3e6e59e205970a6439eb670a23043' },
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Signer:', signer.address);
  const contract = await hre.ethers.getContractAt('Mutation', PROXY_ADDRESS, signer);

  console.log(`\nUpdating quantum hashIds for ${ALL_UPDATES.length} pairs...\n`);

  let success = 0, failed = 0;

  for (const item of ALL_UPDATES) {
    try {
      const pid = await contract.pairIdOf(item.oldHashId as `0x${string}`);
      const tx = await contract.updateQuantumHashId(pid, item.newHashId as `0x${string}`);
      const receipt = await tx.wait();
      console.log(`✅ #${item.tokenId} pid=${pid} → ${item.newHashId.slice(0,16)}... status=${receipt?.status}`);
      success++;
    } catch (e: any) {
      console.error(`❌ #${item.tokenId}: ${e.message?.slice(0, 100)}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} updated, ${failed} failed`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
