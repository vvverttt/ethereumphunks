import hre from 'hardhat';

const PROXY = '0xa48a43186612B179C0bc68Ea34B4932549a70BfA';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const market = await hre.ethers.getContractAt('EtherPhunksMarketV3_1', PROXY, signer);

  // Set royalty to 367 bps = 3.67%
  console.log('Setting royalty BPS to 367 (3.67%)...');
  const tx1 = await market.setRoyaltyBps(367);
  console.log('TX:', tx1.hash);
  await tx1.wait();

  // Set single receiver with 100% share (10000)
  console.log('Setting royalty receiver to 0x19d57A31b982d3d75c16358795A4D19c803e4A72...');
  const tx2 = await market.setRoyaltyReceivers(
    ['0x19d57A31b982d3d75c16358795A4D19c803e4A72'],
    [10000]
  );
  console.log('TX:', tx2.hash);
  await tx2.wait();

  console.log('Done! Royalty: 3.67% to 0x19d57A31b982d3d75c16358795A4D19c803e4A72');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
