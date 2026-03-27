import hre from 'hardhat';

async function main() {
  const auction = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', '0xc1fa86b53e8e101c93c570f276bc5177832bd031');
  const r = await auction.reservePrice();
  console.log('Global reservePrice:', hre.ethers.formatEther(r), 'ETH');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
