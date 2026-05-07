import hre from 'hardhat';

const POINTS = '0xA22a3E40C3C5A01F802c5698Af6Ed5fAA21095eb';
const SAFE_WALLET = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

const users = [
  SAFE_WALLET,
  '0x436196aB0550E73AEEdd1a494C2420DAcA7Fe0Ca',
  '0x78d3AAf8E3cd4B350635C79b7021Bd76144c582C',
];

async function main() {
  const abi = ['function drainPoints(address user) external'];
  const [signer] = await hre.ethers.getSigners();
  const contract = new hre.ethers.Contract(POINTS, abi, signer);

  for (const user of users) {
    console.log(`Draining ${user.slice(0, 10)}...`);
    try {
      const tx = await contract.drainPoints(user);
      await tx.wait();
      console.log(`  TX: ${tx.hash}`);
    } catch (e: any) {
      console.log(`  Error: ${e.reason || e.message?.slice(0, 60)}`);
    }
  }

  console.log('Done. All points drained on-chain.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
