import hre from 'hardhat';

const AUCTION_HOUSE = '0xc1fa86b53e8e101c93c570f276bc5177832bd031';
const LOTTERY1 = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';
const LOTTERY2 = '0x298771ecc338de242ada11e49e2b8224c33bf620';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const auction = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION_HOUSE, signer);
  const lottery1 = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY1, signer);
  const lottery2 = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY2, signer);

  const [aPool, l1Pool, l2Pool] = await Promise.all([
    auction.poolSize(),
    lottery1.poolSize(),
    lottery2.poolSize(),
  ]);

  console.log('Auction house pool size:', aPool.toString());
  console.log('Lottery1 pool size:    ', l1Pool.toString());
  console.log('Lottery2 pool size:    ', l2Pool.toString());
  console.log('Total:                 ', (aPool + l1Pool + l2Pool).toString());
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
