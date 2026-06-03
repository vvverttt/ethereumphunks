import { ethers, upgrades } from "hardhat";

// Deploys the MutationV2 implementation (adds withdrawEthscriptionBatch) and validates it
// against the live Mutation proxy. Does NOT touch the proxy — the upgrade is a separate
// ProxyAdmin call signed by the ProxyAdmin owner (quantumphunks.eth 0x19d57a31).
//
//   npx hardhat run scripts/deploy-mutation-v2.ts --network mainnet   (uses MAINNET_PK)
const MUTATION_PROXY = "0x0b4a5c756c4df0a6fb399bf73ce5667a746dbfba";
const PROXY_ADMIN = "0x33d0b59ec952749bcbe0847b334b075ef47cd7dc";
const PROXY_ADMIN_OWNER = "0x19d57a31b982d3d75c16358795a4d19c803e4a72"; // quantumphunks.eth

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Deployer:", signer.address);

  const Mutation = await ethers.getContractFactory("Mutation");
  const MutationV2 = await ethers.getContractFactory("MutationV2");

  try {
    await upgrades.forceImport(MUTATION_PROXY, Mutation, { kind: "transparent" });
  } catch (e: any) {
    console.log("forceImport note (ok if already imported):", e.message);
  }

  const newImpl = await upgrades.prepareUpgrade(MUTATION_PROXY, MutationV2, { kind: "transparent" });
  console.log("\n✅ MutationV2 implementation deployed at:", newImpl);

  console.log("\n--- FINAL STEP (sign as quantumphunks.eth " + PROXY_ADMIN_OWNER + ") ---");
  console.log("On ProxyAdmin " + PROXY_ADMIN + " call upgradeAndCall:");
  console.log("  proxy          =", MUTATION_PROXY);
  console.log("  implementation =", newImpl);
  console.log("  data           = 0x   (no initializer; no new storage)");
  console.log("\nThen call on the Mutation proxy: withdrawEthscriptionBatch(<86 hashIds>, 0x19d57a31...)");
}

main().catch((e) => { console.error(e); process.exit(1); });
