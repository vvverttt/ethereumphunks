import hre from 'hardhat';

const PROXY = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

// NEW (correct) quantum phunk hashIds
const NEW_HASHIDS = [
  { tokenId: 10004, hash: '0xa4adf3034d941af7788711068f27187a7f2814215aea8370a951a5f77d665725' },  // wait these are OLD
];

// The ACTUAL new hashIds from the authoritative JSONs
const ACTUAL_NEW = [
  { tokenId: 10004, hash: '0x1f9f5d2bb7e8038b3f8b0a6a0bec5cd1feaf56e0a6e9d3f01b1234567890abcd' }, // placeholder
];

// Quantum Missing Phunks new hashIds (correct versions)
const NEW_MISSING = [
  { tokenId: 10004, hash: '0xa4adf3034d941af7788711068f27187a7f2814215aea8370a951a5f77d665725' },
  { tokenId: 10015, hash: '0xb4dd2fcae58ac4c38e6ddc4c113490d665057aa7d1c7d5bdefa3d92b81583ba9' },
  { tokenId: 10058, hash: '0x7707668e833d40514b3972b017a87b48d95319606f3776e36d91afda361a5825' },
  { tokenId: 10078, hash: '0x5c3eb47681fc8966a59adaba4fd85b7cd06e3b643b34a876c71ee02d163dfd7f' },
  { tokenId: 10093, hash: '0x10aef8ca7bbb020e62204b273f958b3f0a6c524ee9ccf24a7ea8163b23b6e4a6' },
  { tokenId: 10099, hash: '0xad6f4303eb6b70301da8fd3e261bd9943878c609603af98c8027c7956e08d6f1' },
  { tokenId: 10207, hash: '0x31b478578539e973101ad77db1e4556ebb46b298f36c4f170a5b37d093d79d32' },
  { tokenId: 10250, hash: '0x8b44334a95310db60e84bdcfe8332330623746dccffc915ab0011e7a309823aa' },
];
const NEW_DYSTO = [
  { tokenId: 10251, hash: '0x413f30c0b85bd3a787b40a8b4152fa3a40c1362525a0ad4620eecaf098ba67e4' },
  { tokenId: 10259, hash: '0x3439136078e5d3cbf059a9d66088100d6efea41f845e4f1949c705915b2a8225' },
  { tokenId: 10261, hash: '0x92778fcc6975840b06c7d843b84e0ae3af2bef4d1fb0c208f1fcb4c309668b90' },
  { tokenId: 10277, hash: '0xbcb6fc2e03fb9cb8ff6b92420d1efeeee96c172a346488fe21413c1cabe90a35' },
  { tokenId: 10287, hash: '0xbddf579de6472ae8eed7a435ca395111ea86cd51de80aa653efa44bb24120285' },
  { tokenId: 10290, hash: '0xec86ed520cda11af33aff0bf8d977510f0ff850819828895133910e6fa7dbe69' },
  { tokenId: 10293, hash: '0xaa04d65f69d28e1b724f0b715fd7dea5cb802b292f2390de154dea5d843e2377' },
  { tokenId: 10295, hash: '0xb9f56a93e45b4fccfb7109dcab2d76c5df67d64aac4a5a2af2a6dde707aba25f' },
  { tokenId: 10298, hash: '0x0b1d7d2bdb9896a75bdc70ee1489e012b79cbe84b30e982c6f54c92f8d70eaad' },
  { tokenId: 10299, hash: '0x2cd4dafac8cc7755b9579575b8a0ce7e04faee52d83c1964ddaa47f06e991613' },
  { tokenId: 10301, hash: '0xfaac0f1d76b283db7542e7877984ae1580dc4f721def628915f7f7c592298614' },
  { tokenId: 10306, hash: '0xd74cec8aeba3b4d3d5944678e14a5225f1f58dca2df2d22f7d56e691faca80e2' },
  { tokenId: 10307, hash: '0x544b706aaf19afd73b8dabaca03fbd4e80de98ab7f0865d6c5a8317da3cbbda3' },
  { tokenId: 10308, hash: '0xd61c2419d8947a60a624924711d6f0ef361aed551326370f96fe5facd4c7b766' },
  { tokenId: 10312, hash: '0x0d2594fa174377c84f219237498968a45df3e6e59e205970a6439eb670a23043' },
];

const ALL = [...NEW_MISSING, ...NEW_DYSTO];

async function main() {
  const contract = await hre.ethers.getContractAt('Mutation', PROXY);
  const ZERO = '0x0000000000000000000000000000000000000000';
  let inContract = 0;

  console.log('Checking NEW (correct) quantum phunk hashIds in contract:\n');
  for (const item of ALL) {
    const dep = await contract.depositor(item.hash as `0x${string}`);
    const reg = await contract.registered(item.hash as `0x${string}`);
    if (dep !== ZERO || reg) {
      console.log(`NEW #${item.tokenId}: depositor=${dep} registered=${reg} ← IN CONTRACT`);
      inContract++;
    } else {
      console.log(`NEW #${item.tokenId}: cleared ✅`);
    }
  }
  console.log(`\n${inContract}/23 new hashIds still have state in contract`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
