// Layout check for the QP market V2 -> V3 low-price-fee upgrade. Read-only, no deploy.
//
// V3 takes two slots from V2's __gap (38 -> 36) for lowPriceThreshold and lowPriceBps. Shrinking
// a gap to append variables is the correct pattern, but it is exactly the kind of change that
// silently corrupts every mapping after it if done wrong — so it gets validated, not eyeballed.
//
//   npx hardhat run scripts/validate-qpmarket-v3.ts
import { ethers, upgrades } from 'hardhat';

async function main() {
  const V2 = await ethers.getContractFactory('contracts/QuantumPhunksMarketMultiV2.sol:QuantumPhunksMarketMultiV2');
  const V3 = await ethers.getContractFactory('contracts/QuantumPhunksMarketMultiV3.sol:QuantumPhunksMarketMultiV3');
  await upgrades.validateUpgrade(V2, V3, { kind: 'uups' });
  console.log('validateUpgrade(V2 -> V3): PASS — storage layout compatible');
}
main().catch((e) => { console.error('FAIL:', (e.message || '').split('\n').slice(0, 8).join('\n')); process.exitCode = 1; });
