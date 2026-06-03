import { ethers, upgrades } from "hardhat";

// Deploys the EtherPhunksMarketV3_4 implementation and validates it against the live
// proxy. Does NOT touch the proxy — the actual upgrade is a separate ProxyAdmin call that
// MUST be signed by the ProxyAdmin owner (quantumphunks.eth 0x19d57a31).
//
// Run with a funded deployer:
//   npx hardhat run scripts/deploy-market-v3_4.ts --network mainnet        (uses MAINNET_PK)
//   npx hardhat run scripts/deploy-market-v3_4.ts --network mainnetFrame   (signs via Frame)
const MARKET_PROXY = "0xa48a43186612b179c0bc68ea34b4932549a70bfa";
const PROXY_ADMIN = "0x1e0fe955ee24d5766e76ce69810496dc30a11c26";
const PROXY_ADMIN_OWNER = "0x19d57a31b982d3d75c16358795a4d19c803e4a72"; // quantumphunks.eth

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Deployer:", signer.address);

  const V3_3 = await ethers.getContractFactory("EtherPhunksMarketV3_3");
  const V3_4 = await ethers.getContractFactory("EtherPhunksMarketV3_4");

  // Register the live proxy with OZ (current impl = V3_3) so prepareUpgrade can validate.
  try {
    await upgrades.forceImport(MARKET_PROXY, V3_3, { kind: "transparent" });
  } catch (e: any) {
    console.log("forceImport note (ok if already imported):", e.message);
  }

  // Validates storage safety AND deploys the new implementation. Proxy is untouched.
  const newImpl = await upgrades.prepareUpgrade(MARKET_PROXY, V3_4, { kind: "transparent" });
  console.log("\n✅ EtherPhunksMarketV3_4 implementation deployed at:", newImpl);

  console.log("\n--- FINAL STEP (sign as quantumphunks.eth " + PROXY_ADMIN_OWNER + ") ---");
  console.log("On ProxyAdmin " + PROXY_ADMIN + " call upgradeAndCall:");
  console.log("  proxy          =", MARKET_PROXY);
  console.log("  implementation =", newImpl);
  console.log("  data           = 0x   (empty — no initializer; V3_4 adds no storage)");
}

main().catch((e) => { console.error(e); process.exit(1); });
