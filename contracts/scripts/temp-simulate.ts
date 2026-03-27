import hre from 'hardhat';

async function main() {
  const addr = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
  const abi = [
    'function currentPrice() view returns (uint256)',
    'function commit(uint256 maxPrice) payable',
    'function paused() view returns (bool)',
    'function poolSize() view returns (uint256)',
    'function pendingReveals() view returns (uint256)',
    'function commitments(address) view returns (uint256,uint256)',
  ];
  const [signer] = await hre.ethers.getSigners();
  const c = new hre.ethers.Contract(addr, abi, signer);

  const price = await c.currentPrice();
  console.log('price:', hre.ethers.formatEther(price), 'ETH');
  console.log('paused:', await c.paused());
  console.log('pool:', Number(await c.poolSize()));
  console.log('pending:', Number(await c.pendingReveals()));
  const com = await c.commitments(signer.address);
  console.log('commitBlock:', Number(com[0]));

  // Static call to simulate commit
  try {
    await c.commit.staticCall(price, { value: price });
    console.log('\nSIMULATION: OK — commit would succeed');
  } catch (e: any) {
    console.log('\nSIMULATION FAIL:', e.reason || e.revert?.args || e.message?.slice(0, 300));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
