import hre, { ethers } from 'hardhat';
async function main() {
  const c = await ethers.getContractAt('Phunkquidity', '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A');
  console.log('Owner:', await c.owner());
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
