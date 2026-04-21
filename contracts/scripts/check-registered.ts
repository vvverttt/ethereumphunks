import hre from 'hardhat';
import { createClient } from '@supabase/supabase-js';

const PROXY = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';
const sb = (createClient as any)(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

const OLD_HASHIDS = [
  { tokenId: 10004, hash: '0xa4adf3034d941af7788711068f27187a7f2814215aea8370a951a5f77d665725' },
  { tokenId: 10015, hash: '0xb4dd2fcae58ac4c38e6ddc4c113490d665057aa7d1c7d5bdefa3d92b81583ba9' },
  { tokenId: 10058, hash: '0x7707668e833d40514b3972b017a87b48d95319606f3776e36d91afda361a5825' },
  { tokenId: 10078, hash: '0x5c3eb47681fc8966a59adaba4fd85b7cd06e3b643b34a876c71ee02d163dfd7f' },
  { tokenId: 10093, hash: '0x4ee9fcae83c10d7013aae58f683d173d2c05bcf19c42d922bc0d0d9b6069ee2f' },
  { tokenId: 10099, hash: '0x7da0e342f53af6941b1722a5dd7df4b3c37bb7d4f434a3234e928796976af4f4' },
  { tokenId: 10207, hash: '0xe1fd42dbc43925c092b7f41c66aa2916bedde4b4f035de82b301b55faf578a21' },
  { tokenId: 10250, hash: '0x5ff2e0c01469b8fa37ded5a22d08683b2e7477fc4b48118dfa6def29ac9254bb' },
  { tokenId: 10251, hash: '0x1dff838ac02192dbd456a209ad5b1aa7cbb8e0afcf2e091b436270ed02db78c8' },
  { tokenId: 10259, hash: '0x0596074cc07975d4bdd6d6ea9e4558db95b69e628ec410329c6fafdac7432ba4' },
  { tokenId: 10261, hash: '0x73594a81bb93f8a912c7173939eb417d09d64397c65f6074e322e8fd0a825fad' },
  { tokenId: 10277, hash: '0x472bb9154a2a798734cbd055a530efb73939fa45d97cc4ef6fe6d9ebb18a2b4f' },
  { tokenId: 10287, hash: '0x9b99836cb4fd4558d1112b53f10b80feb2a6e49eaf2efbd3bd58bc62186f14ad' },
  { tokenId: 10290, hash: '0x84c6cca1cd54bd3cd90f96ef329e7a91bb537a1209cdc55284fefa5f19f3d24c' },
  { tokenId: 10293, hash: '0x476f0c93ec52c4bacfb147974a48ed96e7e964fce46520bef7ed6326cba2cadf' },
  { tokenId: 10295, hash: '0x8c67c4e3721efe2e23efe57623aef3facc448e96a40853e2b80b560c57f0d4a8' },
  { tokenId: 10298, hash: '0xe08effaf3556b2f511246340c84cdf1e0947f896991d51e85ebd1b04d74b1e63' },
  { tokenId: 10299, hash: '0x7598ec4dd273fe2620c2b3be7d1a7313554deaca71432dc9a6634e9b19f130da' },
  { tokenId: 10301, hash: '0x91a2a43c4fb55a3919c42fab28011215e5031169b4502b6d82f6af840dc84441' },
  { tokenId: 10306, hash: '0x70a9b1f88c9a42e59470f17fe9bdabaf03bfe6cd9d4965c083cd0bfb4daf1ff5' },
  { tokenId: 10307, hash: '0x8094b0bd726e5c0b50607b36f0a0f7daea7c44c8c5e0ec8228760c670142c85b' },
  { tokenId: 10308, hash: '0x46c01d736e6881a5865959488ea7cd574a6c111e2ffb41fdec16efec9a6b6439' },
  { tokenId: 10312, hash: '0x820daea5a0aa206dbda20085a58083a570c388e8657bb2334bc12c017f8915b9' },
];

async function main() {
  const contract = await hre.ethers.getContractAt('Mutation', PROXY);

  // Check old hashIds for registered state
  console.log('=== OLD hashIds (should all be false) ===');
  let oldRegistered = 0;
  for (const item of OLD_HASHIDS) {
    const reg = await contract.registered(item.hash as `0x${string}`);
    if (reg) {
      console.log(`OLD #${item.tokenId}: registered=TRUE ← STILL REGISTERED (OLD)`);
      oldRegistered++;
    }
  }
  console.log(`${oldRegistered}/23 old hashIds still registered\n`);

  // Get the new hashIds for the 23 tokens from DB
  const tokenIds = [10004,10015,10058,10078,10093,10099,10207,10250,10251,10259,10261,10277,10287,10290,10293,10295,10298,10299,10301,10306,10307,10308,10312];
  const { data } = await sb.from('ethscriptions').select('tokenId,hashId,owner').in('tokenId', tokenIds).eq('owner', '0xea04f65f9dc5917302532859d80fcf36a15de266');
  
  console.log(`=== NEW hashIds from DB (owner=0xea04) ===`);
  for (const row of (data || [])) {
    const reg = await contract.registered(row.hashId as `0x${string}`);
    const dep = await contract.depositor(row.hashId as `0x${string}`);
    console.log(`#${row.tokenId}: registered=${reg} depositor=${dep === '0x0000000000000000000000000000000000000000' ? 'ZERO' : dep}`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
