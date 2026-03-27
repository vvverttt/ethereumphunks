import hre from 'hardhat';

async function main() {
  const addr = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
  const abi = [{
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'hashId', type: 'bytes32' },
      { indexed: true, internalType: 'address', name: 'buyer', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'price', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'saleNumber', type: 'uint256' },
    ],
    name: 'RockPurchased',
    type: 'event',
  }];
  const c = new hre.ethers.Contract(addr, abi, hre.ethers.provider);
  const filter = c.filters.RockPurchased();
  const currentBlock = await hre.ethers.provider.getBlockNumber();
  const events = await c.queryFilter(filter, currentBlock - 49000);

  console.log(`\n=== ${events.length} Rock Purchases ===\n`);
  for (const ev of events) {
    const args = (ev as any).args;
    console.log(`Sale #${args.saleNumber}:`);
    console.log(`  Buyer:  ${args.buyer}`);
    console.log(`  HashId: ${args.hashId}`);
    console.log(`  Price:  ${hre.ethers.formatEther(args.price)} ETH`);
    console.log(`  Block:  ${ev.blockNumber}`);
    console.log('');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
