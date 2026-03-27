import hre from 'hardhat';

const PROXY = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
const hashIds = [
  '0x17bf0a304e68169dcf2ac13c91938634ea349a488be6d16168c62b6ad1ce4cf9',
  '0xbc04c78f07fd063bc2c730e5f4840885a40e6e02e04d2998134389c77b436351',
  '0xbbf8df6feff11275c0a55de5db78e20e2427fbf258b987f83e3af5565be489d8',
  '0x7fd6dfc166574ec4a0bac70a66662b98ada60ac058e9eee30565f8ed8bda784d',
  '0x0094c1b2c55af5564a1668999b4e7c5f6cb4bb32f7036a95609be0bfdee6c7e7',
];

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', PROXY);

  const pool = await contract.poolSize();
  const pending = await contract.pendingReveals();
  console.log('Pool:', pool.toString(), 'Pending reveals:', pending.toString());

  for (const h of hashIds) {
    console.log('Withdrawing', h.slice(0, 10) + '...');
    try {
      const tx = await contract.withdrawFromPool(h);
      await tx.wait();
      console.log('  OK:', tx.hash);
    } catch (e: any) {
      console.log('  FAILED:', e.reason || e.message?.slice(0, 80));
      // Try emergency withdraw
      try {
        console.log('  Trying emergencyWithdrawEthscription...');
        const tx = await contract.emergencyWithdrawEthscription(h);
        await tx.wait();
        console.log('  OK:', tx.hash);
      } catch (e2: any) {
        console.log('  Emergency also failed:', e2.reason || e2.message?.slice(0, 80));
      }
    }
  }

  const poolAfter = await contract.poolSize();
  console.log('Pool after:', poolAfter.toString());
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
