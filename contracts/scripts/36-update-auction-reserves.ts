import hre from 'hardhat';

const auctionAddress = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';

// tokenId → { hashId, newPrice in ETH }
const updates: { hashId: string; price: string }[] = [
  // XCOPY
  { hashId: '0xa0857574e6f875c31cd0fb015e6169fe9a95b5219d1d740f09f6993663af3b64', price: '5' },       // #699  → 5 ETH
  // Animated
  { hashId: '0xd12f46c6db40a2a23a7482846bca8d8f112e7d09d584bb744d124aa66f77e258', price: '6.7' },     // #783  → 6.7 ETH
  { hashId: '0x930cb7961d029c5e64351d2a0a007de1950c512c086093e15dff99a710ca2f2f', price: '9.5' },     // #5329 → 9.5 ETH
  { hashId: '0x348e8fe294214f7fd6cd10bbf982fd6a4db6ee09957e3f742336ad6d93fc79a9', price: '2.56' },    // #5733 → 2.56 ETH
  { hashId: '0x8b910893e28c09f72ab9e5679d88fd9c889e3840d59343c5347905b76e90cf43', price: '4.69' },    // #619  → 4.69 ETH
  // Character / One of One / Phunkism
  { hashId: '0x81719f7cc6938a8d06d9b9646e2bcb2346e721514b7876db9cb3b05d3d03cfd2', price: '28' },      // #446  → 28 ETH
  { hashId: '0xa6e3c4a34beab97bc44469134b0a3fea11a3ed8513484c192d35019c58c9a851', price: '7.2' },     // #723  → 7.2 ETH
  { hashId: '0x602015b6fd1bdfd076690fc3dd28a15ba0858b58d13760f75149cf57fecc5834', price: '1.88' },    // #883  → 1.88 ETH
  { hashId: '0x20c817d8f1271cc6c71a1d7a9fced5c7e510e016aee35447dd88f05e4f4f41f2', price: '92.5' },    // #1884 → 92.5 ETH
  { hashId: '0x852cdbbb29712d9f61f6b17047c2ce24efe5e50f853010f31086d2f6d92c4fb5', price: '35' },      // #2512 → 35 ETH
  { hashId: '0xb4d410871a531d1aece3cce272a20f905ab35da28a785160f9d853f4eced50fb', price: '51' },      // #2773 → 51 ETH
  { hashId: '0xf0c49c8bf8043112cedcf2651437c7d1bc0780869f658669bf567e31f3c1b302', price: '246' },     // #3460 → 246 ETH
  { hashId: '0xef70c799209046e74e3635120391f4b4e56c2fb1b9a86e388bbfd4fd37a27aef', price: '138' },     // #4335 → 138 ETH
  { hashId: '0xfa19cfbe9681e805885df576d4b197f5a2c93b76a372ac3d430945c934755db6', price: '231' },     // #4960 → 231 ETH
  { hashId: '0xe294702614a8f61ebc75dd90c319d9a7eb783ed05bc49ca376fec452f3e4dd66', price: '25' },      // #5034 → 25 ETH
  { hashId: '0xadd3fa97d8287423d8d9a3e65b1bb62307b87ab2a4f2aadc7da69173792aaec7', price: '11' },      // #5614 → 11 ETH
  { hashId: '0xa82f471d3b153c42a8a822f808529b73ecda0ea2780d0943254dae143a777cd5', price: '117' },     // #6134 → 117 ETH
  { hashId: '0xe88fae4f40ec647f0ac8a17242f05ee5b081aa29b56bb9fd8074e57afae6589d', price: '110' },     // #7201 → 110 ETH
  { hashId: '0xd89dc95da882a8809a06c912378b61500e79aebd344a4041750ec29f393e4a33', price: '22' },      // #8274 → 22 ETH
  { hashId: '0x09c21e77aab7e837db1292884dd84a4e5f27073e4c91b42794fb7c835f673d31', price: '195' },     // #9697 → 195 ETH
  { hashId: '0xb55b490eb9af90ecb14cd84870f91ca33dee31a2df2c5f629db58b68b268387f', price: '2567' },    // #8450 → 2567 ETH
  { hashId: '0xd9fc3b0ad24072c2128d9634b6d09db8e5b25ce1de45aaa971a0fcb97eb1d3d7', price: '95' },      // #244  → 95 ETH
  { hashId: '0x57785a97eb4eb690bfad5cccdf54e93aac906f027c5b7dc0f44e307bec3bf651', price: '32' },      // #32   → 32 ETH
  { hashId: '0xe63e2e8d2e09415406f72de23ffa1bad8cf5a48b6d2928bf7e5fdfd42e3975f8', price: '67' },      // #7194 → 67 ETH
];

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Updating Auction Reserve Prices (24 items)');
  console.log(`  Signer:   ${signer.address}`);
  console.log(`  Auction:  ${auctionAddress}`);
  console.log('=====================================================================\n');

  for (const u of updates) {
    console.log(`  ${u.hashId.slice(0, 10)}... → ${u.price} ETH`);
  }

  console.log('\n  Waiting 5s before sending...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const hashIds = updates.map(u => u.hashId);
  const prices = updates.map(u => hre.ethers.parseEther(u.price));

  const auction = await hre.ethers.getContractAt(
    ['function setItemReservePrices(bytes32[] calldata hashIds, uint256[] calldata prices) external'],
    auctionAddress
  );

  const tx = await auction.setItemReservePrices(hashIds, prices);
  console.log(`\n  tx: ${tx.hash}`);
  await tx.wait();

  console.log('  Confirmed! All 24 reserve prices updated.');
  console.log('=====================================================================\n');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
