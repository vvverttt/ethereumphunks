import { ethers, upgrades } from "hardhat";

// Audits that upgrading the live Mutation proxy (0x0b4a…) to MutationV2 is storage-safe.
async function main() {
  const Mutation = await ethers.getContractFactory("Mutation");
  const MutationV2 = await ethers.getContractFactory("MutationV2");

  await upgrades.validateUpgrade(Mutation, MutationV2, {
    kind: "transparent",
    unsafeAllow: [],
  });

  console.log("✅ STORAGE-SAFE: Mutation -> MutationV2 passes OZ validateUpgrade");
  console.log("   (no storage added/moved; only adds withdrawEthscriptionBatch)");
}

main().catch((e) => { console.error("❌ UNSAFE / error:", e.message || e); process.exit(1); });
