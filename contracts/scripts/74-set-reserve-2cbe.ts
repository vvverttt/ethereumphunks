import hre from 'hardhat';
const AUCTION_ADDRESS = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';
async function main() {
  const [signer] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt('EtherPhunksAuctionHouseV2', AUCTION_ADDRESS, signer);
  const tx = await contract.setItemReservePrices(
    ['0x2cbe11f88544529151b2767352782e0f23ae349282a253804539eb45dcbea0c8'],
    [hre.ethers.parseEther('670')]
  );
  const receipt = await tx.wait();
  console.log(`TX: ${receipt?.hash} status=${receipt?.status}`);
  console.log('Set to 42 ETH ✅');
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
