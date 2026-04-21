/**
 * fix-auction-house-ownership.js
 *
 * Updates owner from auction house → recipient for the 49 tokens
 * withdrawn from the auction pool. Skips #5984 which is currently on auction.
 *
 * Run: SUPABASE_SERVICE_ROLE=... node fix-auction-house-ownership.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || '';
const AUCTION_HOUSE = '0xc1fa86b53e8e101c93c570f276bc5177832bd031';
const RECIPIENT = '0xea04f65f9dc5917302532859d80fcf36a15de266';
// #5984 is currently on auction — leave it owned by auction house
const SKIP_HASHID = '0x3271da51bbfd07907ea3494d6b42dc19e3df777dc1c62e2326ceaa184a404419';

const WITHDRAWN_HASHIDS = [
  '0x9a46c14148c235caee361abdd9d0de5520bb058c6c967e1aabbd8c8f2daed808',
  '0xf711cb948f22404fe329126060a501ce7f55e90eaf8ef439242f85b8e219b0e1',
  '0x3984eef58906acb5655ffe4244c8c38cf6da9f0c0485da3c7d2c8b151fac2509',
  '0x1096c46eb76219992fe310c9e4eb301b301bd84dc976fc845b0cac43dd4e4a16',
  '0xb55b490eb9af90ecb14cd84870f91ca33dee31a2df2c5f629db58b68b268387f',
  '0xe294702614a8f61ebc75dd90c319d9a7eb783ed05bc49ca376fec452f3e4dd66',
  '0x8b910893e28c09f72ab9e5679d88fd9c889e3840d59343c5347905b76e90cf43',
  '0xa82f471d3b153c42a8a822f808529b73ecda0ea2780d0943254dae143a777cd5',
  '0xd12f46c6db40a2a23a7482846bca8d8f112e7d09d584bb744d124aa66f77e258',
  '0x348e8fe294214f7fd6cd10bbf982fd6a4db6ee09957e3f742336ad6d93fc79a9',
  '0x930cb7961d029c5e64351d2a0a007de1950c512c086093e15dff99a710ca2f2f',
  '0xc070f14939abf7daa994b72fc75eab23a58beecb6f3762eb72bc99f78ce19e57',
  '0x873dae391d1e2b7a20894f33c40e01d0c41f47deabc29773d45ff5cb304b3107',
  '0x95ea064f5a378a899ca665fc24cf7f7387552bb4071d2f2623ddba1355a2b37f',
  '0xe63e2e8d2e09415406f72de23ffa1bad8cf5a48b6d2928bf7e5fdfd42e3975f8',
  '0x130017a08279bd18cd7fa204858a6c206b6dcdc40e8d04b2004a878061c1d287',
  '0xe9dc854b9f7f044343e2af44dafb8d9d588e068bdce902d6c646a3c53da83761',
  '0xcd9b6d75bf1a4dc8cedb11a2d794f818a0d8f735c47cdf41db15219f430288b1',
  '0x1ce5117db1f9ada51687750fe2d989b8e0b3cd48fc78b7f3acd324f0505a5dc2',
  '0x6577bb3aaeac7b311b791b6f92617a423d69d3bff34fc9ffb259be9f207082e9',
  '0xa866c29fb837a573bdf8adada07c2a51ca65c887af1fe1740415f89c15f72f75',
  '0x21405f30c4613b8dde35a9a9719144270d1c7a61934d812302252fbf98f0b93b',
  '0x2cbe11f88544529151b2767352782e0f23ae349282a253804539eb45dcbea0c8',
  '0xb023872aab34b83fd434ed099643230d6bc1e0359bc1880b69b00c8427a6e38f',
  '0xa0857574e6f875c31cd0fb015e6169fe9a95b5219d1d740f09f6993663af3b64',
  '0xe3d85da231fa8aef475ba2c1736dbb8b910ed94a99d352cf257407a5e9a30d10',
  '0x852cdbbb29712d9f61f6b17047c2ce24efe5e50f853010f31086d2f6d92c4fb5',
  '0x65cf8f080ac5888775b4474cea9ad1aa3c1967aa4573ce158dc49f0cddb2c67a',
  '0x7c39f365f790d9919c47147c6021a8dd6523e58f657ffe45bbcfd9662ee86146',
  '0x09c21e77aab7e837db1292884dd84a4e5f27073e4c91b42794fb7c835f673d31',
  '0x956d03a761982b57547c97fa5e2f298beb581b01a557aa7f3aa6e5b9c9f5aeb2',
  '0x20c817d8f1271cc6c71a1d7a9fced5c7e510e016aee35447dd88f05e4f4f41f2',
  '0x57785a97eb4eb690bfad5cccdf54e93aac906f027c5b7dc0f44e307bec3bf651',
  '0x8cfc42ad57ac26e1b2d7ae95d706cefc9aeafa468c36bf978bc63da8cf4a77c1',
  '0x602015b6fd1bdfd076690fc3dd28a15ba0858b58d13760f75149cf57fecc5834',
  '0xa6e3c4a34beab97bc44469134b0a3fea11a3ed8513484c192d35019c58c9a851',
  '0xd9fc3b0ad24072c2128d9634b6d09db8e5b25ce1de45aaa971a0fcb97eb1d3d7',
  '0xb4d410871a531d1aece3cce272a20f905ab35da28a785160f9d853f4eced50fb',
  '0x81719f7cc6938a8d06d9b9646e2bcb2346e721514b7876db9cb3b05d3d03cfd2',
  '0xf0c49c8bf8043112cedcf2651437c7d1bc0780869f658669bf567e31f3c1b302',
  '0xce2c69be8cd1439b03e35af6e3e0fb2d373eb27d65b90fb07db2de8d49dbb3cf',
  '0xadd3fa97d8287423d8d9a3e65b1bb62307b87ab2a4f2aadc7da69173792aaec7',
  '0xef70c799209046e74e3635120391f4b4e56c2fb1b9a86e388bbfd4fd37a27aef',
  '0xfa19cfbe9681e805885df576d4b197f5a2c93b76a372ac3d430945c934755db6',
  '0x96ed5803a3e7c80e95c8204a1ebe10fbe7cd6dd080dab4fd9c15db94255658e9',
  '0xe88fae4f40ec647f0ac8a17242f05ee5b081aa29b56bb9fd8074e57afae6589d',
  '0x39117a2f9e7fa825efc766c843065c757071133e673b30d7a63d7bf839fc6c24',
  '0xad192b0d499a6fe8b25d23197b2a201fd23481fd3269509f9d1f94e7bade6c18',
  '0xd89dc95da882a8809a06c912378b61500e79aebd344a4041750ec29f393e4a33',
];

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  const hashIds = WITHDRAWN_HASHIDS.filter(h => h !== SKIP_HASHID);
  console.log(`Updating ${hashIds.length} tokens: auction house → ${RECIPIENT}`);
  console.log(`Skipping ${SKIP_HASHID.slice(0,14)}... (#5984, active auction)\n`);

  const { data, error } = await supabase
    .from('ethscriptions')
    .update({ owner: RECIPIENT })
    .in('hashId', hashIds)
    .select('hashId, tokenId');

  if (error) { console.error('Error:', error.message); return; }
  console.log(`✅ Updated ${data.length} tokens`);
  data.forEach(r => console.log('  #' + r.tokenId));

  // Verify remaining auction house owned
  const { data: remaining } = await supabase
    .from('ethscriptions')
    .select('hashId, tokenId')
    .eq('owner', AUCTION_HOUSE)
    .eq('slug', 'cryptophunksv67');
  console.log(`\nAuction house still owns ${remaining?.length} token(s) (should be 1: #5984)`);
  remaining?.forEach(r => console.log('  #' + r.tokenId, r.hashId.slice(0,14) + '...'));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
