import hre, { upgrades, ethers } from 'hardhat';

const PHUNKQUIDITY = '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A';
const TREASURY = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  console.log(`Target treasury: ${TREASURY}`);

  const phunkquidity = await ethers.getContractAt('Phunkquidity', PHUNKQUIDITY);

  const currentOwner = await phunkquidity.owner();
  console.log(`\nCurrent contract owner: ${currentOwner}`);
  if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error('Signer is not the current owner');
  }

  // 1. Transfer contract ownership
  console.log(`\n→ Transferring contract ownership to ${TREASURY}...`);
  const tx1 = await phunkquidity.transferOwnership(TREASURY);
  await tx1.wait();
  console.log(`  ✓ ${tx1.hash}`);

  const newOwner = await phunkquidity.owner();
  console.log(`  New owner: ${newOwner}`);

  // 2. Transfer ProxyAdmin ownership
  const adminAddr = await upgrades.erc1967.getAdminAddress(PHUNKQUIDITY);
  console.log(`\nProxyAdmin: ${adminAddr}`);
  const proxyAdmin = await ethers.getContractAt(
    ['function owner() view returns (address)', 'function transferOwnership(address) external'],
    adminAddr
  );
  const adminOwner = await proxyAdmin.owner();
  console.log(`Current ProxyAdmin owner: ${adminOwner}`);

  if (adminOwner.toLowerCase() === signer.address.toLowerCase()) {
    console.log(`\n→ Transferring ProxyAdmin ownership to ${TREASURY}...`);
    const tx2 = await proxyAdmin.transferOwnership(TREASURY);
    await tx2.wait();
    console.log(`  ✓ ${tx2.hash}`);
    console.log(`  New ProxyAdmin owner: ${await proxyAdmin.owner()}`);
  } else {
    console.log(`  Skipping — signer is not ProxyAdmin owner`);
  }

  console.log(`\n✓ Done. Treasury now controls Phunkquidity contract + upgrades.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
