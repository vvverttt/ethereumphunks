import hre from 'hardhat';

const AUCTION_HOUSE = '0xc1fa86b53e8e101c93c570f276bc5177832bd031';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION_HOUSE, signer);

  const auction = await contract.auction();
  console.log('Current auction:');
  console.log('  hashId:   ', auction.hashId);
  console.log('  auctionId:', auction.auctionId.toString());
  console.log('  bidder:   ', auction.bidder);
  console.log('  amount:   ', hre.ethers.formatEther(auction.amount), 'ETH');
  console.log('  endTime:  ', new Date(Number(auction.endTime) * 1000).toISOString());
  console.log('  settled:  ', auction.settled);

  const now = Math.floor(Date.now() / 1000);
  if (auction.settled) { console.log('\nAlready settled.'); return; }
  if (Number(auction.endTime) > now) { console.log('\nAuction not ended yet — ends in', Number(auction.endTime) - now, 'seconds.'); return; }

  console.log('\nSettling...');
  const gas = await contract.settleAndCreate.estimateGas();
  const feeData = await hre.ethers.provider.getFeeData();
  console.log('Estimated gas:', gas.toLocaleString(), '=', hre.ethers.formatEther(gas * feeData.gasPrice!), 'ETH');

  const tx = await contract.settleAndCreate();
  console.log('Tx:', tx.hash);
  const receipt = await tx.wait();
  console.log('✅ Confirmed block', receipt?.blockNumber);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
