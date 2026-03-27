import hre from 'hardhat';

async function main() {
  const addr = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
  const abi = [
    'function currentPrice() view returns (uint256)',
    'function paused() view returns (bool)',
    'function poolSize() view returns (uint256)',
    'function pendingReveals() view returns (uint256)',
    'function totalRevealed() view returns (uint256)',
    'function totalCommittedETH() view returns (uint256)',
    'function commitments(address) view returns (uint256,uint256)',
    'function pendingReturns(address) view returns (uint256)',
    'function getBalance() view returns (uint256)',
    'function treasuryAddress() view returns (address)',
  ];
  const [signer] = await hre.ethers.getSigners();
  const c = new hre.ethers.Contract(addr, abi, signer);

  console.log('=== Contract State ===');
  console.log('price:', hre.ethers.formatEther(await c.currentPrice()), 'ETH');
  console.log('paused:', await c.paused());
  console.log('pool:', Number(await c.poolSize()));
  console.log('pending reveals:', Number(await c.pendingReveals()));
  console.log('total revealed:', Number(await c.totalRevealed()));
  console.log('contract balance:', hre.ethers.formatEther(await c.getBalance()), 'ETH');
  console.log('totalCommittedETH:', hre.ethers.formatEther(await c.totalCommittedETH()), 'ETH');
  console.log('treasury:', await c.treasuryAddress());

  console.log('\n=== Signer State ===');
  const com = await c.commitments(signer.address);
  console.log('commitBlock:', Number(com[0]));
  console.log('priceLocked:', hre.ethers.formatEther(com[1]), 'ETH');
  console.log('pendingReturns:', hre.ethers.formatEther(await c.pendingReturns(signer.address)), 'ETH');
  console.log('wallet balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(signer.address)), 'ETH');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
