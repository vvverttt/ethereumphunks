import hre from 'hardhat';

const auctionAddress = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  console.log('\n=====================================================================');
  console.log('Updating Auction Reserve Price: #446 → 180 ETH');
  console.log(`  Signer:   ${signer.address}`);
  console.log(`  Auction:  ${auctionAddress}`);
  console.log('=====================================================================');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const auction = await hre.ethers.getContractAt(
    ['function setItemReservePrices(bytes32[] calldata hashIds, uint256[] calldata prices) external'],
    auctionAddress
  );

  const tx = await auction.setItemReservePrices(
    ['0x81719f7cc6938a8d06d9b9646e2bcb2346e721514b7876db9cb3b05d3d03cfd2'],
    [hre.ethers.parseEther('180')]
  );
  console.log(`\n  tx: ${tx.hash}`);
  await tx.wait();

  console.log('  Confirmed! #446 reserve updated to 180 ETH.');
  console.log('=====================================================================\n');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
