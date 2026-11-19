// Local-only pre-deploy checks for V67AuctionHouse: bytecode size and OZ UUPS upgrade safety.
// Run: npx hardhat run scripts/check-v67-auction.ts   (no network calls, no deploy)
import { ethers, upgrades, artifacts } from 'hardhat';

async function main() {
  const a = await artifacts.readArtifact('V67AuctionHouse');
  console.log(`runtime bytecode: ${(a.deployedBytecode.length - 2) / 2} / 24576 bytes`);
  const F = await ethers.getContractFactory('V67AuctionHouse');
  await upgrades.validateImplementation(F, { kind: 'uups' });
  console.log('validateImplementation: OK (UUPS-safe)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
