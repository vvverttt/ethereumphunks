import { ethers, upgrades } from "hardhat";

// Audits that upgrading the live market (currently EtherPhunksMarketV3_3) to
// EtherPhunksMarketV3_4 is storage-layout safe (OZ transparent-proxy rules).
async function main() {
  const V3_3 = await ethers.getContractFactory("EtherPhunksMarketV3_3");
  const V3_4 = await ethers.getContractFactory("EtherPhunksMarketV3_4");

  await upgrades.validateUpgrade(V3_3, V3_4, {
    kind: "transparent",
    unsafeAllow: [],
  });

  console.log("✅ STORAGE-SAFE: EtherPhunksMarketV3_3 -> EtherPhunksMarketV3_4 passes OZ validateUpgrade");
  console.log("   (no storage added/moved; only _buyPhunk override + 1 internal helper)");
}

main().catch((e) => {
  console.error("❌ UNSAFE / error:", e.message || e);
  process.exit(1);
});
