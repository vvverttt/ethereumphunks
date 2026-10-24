/**
 * Deploy ONE of the new ERC-721C collections behind a UUPS proxy.
 * Same contract shape as CryptoPhunksV67 (fully on-chain, upgradeable, ERC-4906 refresh).
 *
 *   COLLECTION=missing|dysto|rocks|turtles \
 *   TREASURY=0x..  OWNER=0x.. \
 *   npx hardhat run scripts/deploy-collection.ts --network mainnet
 *
 * TREASURY = ERC-2981 royalty receiver (defaults to the v67 donations treasury).
 * OWNER    = admin that can set images/traits/background later and authorize UUPS upgrades
 *            (defaults to the deployer). Renounce it when the collection is final to lock forever.
 */
import { ethers, upgrades } from 'hardhat';

const MAP: Record<string, { contract: string; name: string; symbol: string }> = {
  missing: { contract: 'QuantumMissingPhunks', name: 'QuantumMissingPhunks', symbol: 'QMPHUNK' },
  dysto:   { contract: 'QuantumDystoPhunkz',   name: 'QuantumDystoPhunkz',   symbol: 'QDPHUNK' },
  rocks:   { contract: 'EtherRockz',           name: 'EtherRockz',           symbol: 'ROCKZ'   },
  turtles: { contract: 'QuantumTurtlez',       name: 'QuantumTurtlez',       symbol: 'QTURTLE' },
};

const DEFAULT_TREASURY = '0x8191f333Da8fEB4De8Ec0d929b136297FDAA34de'; // v67 donations treasury (royalty receiver)

async function main() {
  const key = (process.env.COLLECTION || '').toLowerCase();
  const cfg = MAP[key];
  if (!cfg) throw new Error(`Set COLLECTION=missing|dysto|rocks|turtles (got "${process.env.COLLECTION}")`);

  const [deployer] = await ethers.getSigners();
  const treasury = ethers.getAddress(process.env.TREASURY || DEFAULT_TREASURY);
  const owner = ethers.getAddress(process.env.OWNER || deployer.address);

  console.log(`Deploying ${cfg.contract}`);
  console.log('  deployer :', deployer.address);
  console.log('  balance  :', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH');
  console.log('  treasury :', treasury, '(royalties, 5%)');
  console.log('  owner    :', owner);

  const F = await ethers.getContractFactory(cfg.contract);
  const proxy = await upgrades.deployProxy(F, [cfg.name, cfg.symbol, treasury, owner], { kind: 'uups', initializer: 'initialize' });
  await proxy.waitForDeployment();

  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log('\n✅  Proxy         :', proxyAddress);
  console.log('✅  Implementation:', implAddress);
  console.log(`\nNext: populate with  COLLECTION=${key} NFT_ADDRESS=${proxyAddress} MAX_GWEI=0.06 npx hardhat run scripts/populate-collection.ts --network mainnet`);
  console.log('Then add to marketplace/src/app/constants/erc721c.ts (ERC721C_CONTRACTS + ERC721C_CONTRACT_SETS).');
}
main().catch((e) => { console.error(e); process.exit(1); });
