/**
 * Deploy the EtherPhunksAuctionHouseV7 IMPLEMENTATION only.
 *
 * Does NOT touch the live proxy (0xc1fA86b53e8e101c93c570f276bC5177832bd031). A bare
 * implementation is inert until the ProxyAdmin owner points the proxy at it.
 *
 * The auction house is a TRANSPARENT proxy, unlike the NFT. There is no upgradeToAndCall on
 * the proxy — the upgrade goes through the ProxyAdmin at 0xd043f41f07e7bc140e51971f7dd3c33ab35508ad,
 * owned by quantumphunks.eth. This script prints that call at the end.
 *
 * What V7 changes: retires buyNow / buyNow2 / setBuyNow / setBuyNow2 (V6 retired only buyItem,
 * and buyNow2 was found ARMED on mainnet at 0.167 ETH behind a live merkle root, held back
 * only by the pause), and rejects a zero points address.
 *
 * Dry-run by default. RUN=1 to broadcast.
 */
import hre from 'hardhat';
import fs from 'fs';
import path from 'path';
import { ethers as vanillaEthers } from 'ethers';

const PROXY = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';
const PROXY_ADMIN = '0xd043f41f07e7bc140e51971f7dd3c33ab35508ad';
const NAME = 'contracts/V2MainnetUpgrade/EtherPhunksAuctionHouseV7.sol:EtherPhunksAuctionHouseV7';
const DEPLOYER = '0x10dc1ABC3E14a494C78d1e6F15185264154D5949';
const LIVE = process.env.RUN === '1';

/** Deployer key is PRIVATE_KEY in the REPO-ROOT .env — see deploy-nft-v2-impl.ts for why. */
function burnerKey(): string {
  const p = path.join(__dirname, '..', '..', '.env');
  const m = fs.readFileSync(p, 'utf8').match(/^PRIVATE_KEY=(0x)?([a-fA-F0-9]{64})$/m);
  if (!m) throw new Error(`PRIVATE_KEY not found in ${p}`);
  return '0x' + m[2];
}

async function main() {
  const { ethers, upgrades, artifacts } = hre as any;
  const wallet = new vanillaEthers.Wallet(burnerKey(), ethers.provider);
  const me = wallet.address;
  if (me.toLowerCase() !== DEPLOYER.toLowerCase()) {
    throw new Error(`root .env PRIVATE_KEY is ${me}, expected the deployer ${DEPLOYER}`);
  }

  const net = await ethers.provider.getNetwork();
  if (net.chainId !== 1n) throw new Error(`wrong network: ${net.chainId}`);

  // Layout check against what is actually live. The proxy was deployed outside the upgrades
  // plugin, so import it first or validateUpgrade fails as "not registered" — bookkeeping,
  // not a layout problem.
  const V6 = await ethers.getContractFactory('contracts/V2MainnetUpgrade/EtherPhunksAuctionHouseV6.sol:EtherPhunksAuctionHouseV6');
  try { await upgrades.forceImport(PROXY, V6, { kind: 'transparent' }); } catch { /* already imported */ }

  const V7 = await ethers.getContractFactory(NAME);
  await upgrades.validateUpgrade(PROXY, V7, { kind: 'transparent' });
  console.log('validateUpgrade: PASS (storage layout compatible)');

  const art = await artifacts.readArtifact(NAME);
  const size = art.deployedBytecode.length / 2 - 1;
  console.log(`impl size: ${size} bytes (limit 24576)`);
  if (size > 24576) throw new Error('over the contract size limit');

  // ESTIMATE the gas. A hardcoded limit burned a deploy on the NFT: storing the runtime code
  // alone is 200 gas per byte, which a "generous"-looking round number can sit under. An
  // out-of-gas deploy reverts with status 0 and still charges the full limit.
  const deployTx = await new vanillaEthers.ContractFactory(art.abi, art.bytecode, wallet).getDeployTransaction();
  const estimated = await ethers.provider.estimateGas({ from: me, data: deployTx.data });
  const floor = BigInt(size) * 200n + 100_000n;
  const gas = ((estimated > floor ? estimated : floor) * 125n) / 100n;
  console.log(`gas estimate: ${estimated.toLocaleString()}  (floor ${floor.toLocaleString()}) -> limit ${gas.toLocaleString()}`);

  const fee = await ethers.provider.getFeeData();
  const bal = await ethers.provider.getBalance(me);
  const cost = gas * (fee.maxFeePerGas ?? fee.gasPrice ?? 0n);
  console.log(`deployer:  ${me}`);
  console.log(`balance:   ${ethers.formatEther(bal)} ETH`);
  console.log(`gas price: ${ethers.formatUnits(fee.maxFeePerGas ?? fee.gasPrice ?? 0n, 'gwei')} gwei`);
  console.log(`max cost:  ~${ethers.formatEther(cost)} ETH`);

  if (!LIVE) { console.log('\nDRY RUN — nothing broadcast. Re-run with RUN=1 to deploy.'); return; }
  if (bal < cost) throw new Error('insufficient balance for the deploy');

  const factory = new vanillaEthers.ContractFactory(art.abi, art.bytecode, wallet);
  const tx = await factory.getDeployTransaction();
  const sent = await wallet.sendTransaction({ data: tx.data, gasLimit: gas });
  console.log(`\ntx: ${sent.hash}`);
  const rcpt = await sent.wait();
  const impl = rcpt!.contractAddress;
  console.log(`implementation deployed: ${impl}`);

  console.log('\nNext, from quantumphunks.eth on Etherscan:');
  console.log(`  ProxyAdmin  ${PROXY_ADMIN}  ->  Write Contract  ->  upgradeAndCall`);
  console.log(`    proxy  ${PROXY}`);
  console.log(`    implementation  ${impl}`);
  console.log(`    data   0x`);
  console.log('\n  (TRANSPARENT proxy — the call is on the ProxyAdmin, NOT on the auction itself.)');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
