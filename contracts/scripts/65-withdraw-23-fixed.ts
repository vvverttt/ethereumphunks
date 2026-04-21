import hre from 'hardhat';

const PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

// All 23 new (correct) quantum phunk hashIds
const ALL_23 = [
  // Quantum Missing Phunks (8)
  '0xa4adf3034d941af7788711068f27187a7f2814215aea8370a951a5f77d665725', // #10004 (old hash — will skip, check3 showed these are in DB as 0xea04)
  // Actually use new hashIds from DB (owner=0xea04)
];

// Get from DB — hardcode from check3 results (MISMATCH rows = new hashIds)
const NEW_HASHIDS_FROM_DB = [
  // These are the hashIds where events show "to=contract" at block 24504065/24504089
  // and DB owner was manually set to 0xea04
  // Quantum Missing Phunks new hashIds:
  '0x10aef8ca7bbb020e62204b273f958b3f0a6c524ee9ccf24a7ea8163b23b6e4a6', // #10093 (already withdrew, will retry)
  '0xad6f4303eb6b70301da8fd3e261bd9943878c609603af98c8027c7956e08d6f1', // #10099
  '0x31b478578539e973101ad77db1e4556ebb46b298f36c4f170a5b37d093d79d32', // #10207
  '0x8b44334a95310db60e84bdcfe8332330623746dccffc915ab0011e7a309823aa', // #10250
  // Quantum DystoPhunks new hashIds:
  '0x413f30c0b85bd3a787b40a8b4152fa3a40c1362525a0ad4620eecaf098ba67e4', // #10251
  '0x3439136078e5d3cbf059a9d66088100d6efea41f845e4f1949c705915b2a8225', // #10259
  '0x92778fcc6975840b06c7d843b84e0ae3af2bef4d1fb0c208f1fcb4c309668b90', // #10261
  '0xbcb6fc2e03fb9cb8ff6b92420d1efeeee96c172a346488fe21413c1cabe90a35', // #10277
  '0xbddf579de6472ae8eed7a435ca395111ea86cd51de80aa653efa44bb24120285', // #10287
  '0xec86ed520cda11af33aff0bf8d977510f0ff850819828895133910e6fa7dbe69', // #10290
  '0xaa04d65f69d28e1b724f0b715fd7dea5cb802b292f2390de154dea5d843e2377', // #10293
  '0xb9f56a93e45b4fccfb7109dcab2d76c5df67d64aac4a5a2af2a6dde707aba25f', // #10295
  '0x0b1d7d2bdb9896a75bdc70ee1489e012b79cbe84b30e982c6f54c92f8d70eaad', // #10298
  '0x2cd4dafac8cc7755b9579575b8a0ce7e04faee52d83c1964ddaa47f06e991613', // #10299
  '0xfaac0f1d76b283db7542e7877984ae1580dc4f721def628915f7f7c592298614', // #10301
  '0xd74cec8aeba3b4d3d5944678e14a5225f1f58dca2df2d22f7d56e691faca80e2', // #10306
  '0x544b706aaf19afd73b8dabaca03fbd4e80de98ab7f0865d6c5a8317da3cbbda3', // #10307
  '0xd61c2419d8947a60a624924711d6f0ef361aed551326370f96fe5facd4c7b766', // #10308
  '0x0d2594fa174377c84f219237498968a45df3e6e59e205970a6439eb670a23043', // #10312
];

// Also need the new hashIds for #10004, #10015, #10058, #10078
// These were "already withdrawn" in a previous session — query DB to get them
import { createClient } from '@supabase/supabase-js';
const sb = (createClient as any)(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Signer:', signer.address);
  const contract = await hre.ethers.getContractAt('Mutation', PROXY_ADDRESS, signer);

  // Get new hashIds for the 4 that were "already withdrawn" (#10004, #10015, #10058, #10078)
  const { data: extra } = await sb
    .from('ethscriptions')
    .select('tokenId, hashId')
    .in('tokenId', [10004, 10015, 10058, 10078])
    .eq('owner', '0xea04f65f9dc5917302532859d80fcf36a15de266');

  const extraHashIds = (extra || []).map((r: any) => r.hashId);
  console.log(`Extra 4 hashIds from DB: ${extraHashIds.length}`);
  for (const row of (extra || [])) {
    console.log(`  #${row.tokenId}: ${row.hashId}`);
  }

  const allHashIds = [...extraHashIds, ...NEW_HASHIDS_FROM_DB];
  console.log(`\nWithdrawing ${allHashIds.length} tokens with FIXED previousOwner...\n`);

  let success = 0, failed = 0;
  for (const hashId of allHashIds) {
    try {
      const tx = await contract.withdrawEthscription(hashId as `0x${string}`, signer.address);
      const receipt = await tx.wait();
      console.log(`✅ ${hashId.slice(0, 18)}... tx=${receipt?.hash?.slice(0, 18)}... status=${receipt?.status}`);
      success++;
    } catch (e: any) {
      console.error(`❌ ${hashId.slice(0, 18)}...: ${e.message?.slice(0, 100)}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
