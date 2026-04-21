import hre from 'hardhat';

async function main() {
  const c = await hre.ethers.getContractAt('Phunkquidity', '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A');
  const slug = hre.ethers.id('v2-phunks');
  console.log('Adding V2 Phunks (' + slug + ')...');
  const tx = await c.addCollection(
    slug,
    0,
    '0xf07468ead8cf26c752c676e43c814fee9c8cf402',
    '0x0000000000000000000000000000000000000000000000000000000000000000',
    100
  );
  await tx.wait();
  console.log('TX:', tx.hash);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
