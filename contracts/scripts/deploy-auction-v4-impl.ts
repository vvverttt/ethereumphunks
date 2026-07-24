/**
 * Deploy the EtherPhunksAuctionHouseV4 IMPLEMENTATION only (adds the second buy-now tier: buyNow2).
 *
 * Does NOT touch the live proxy (0xc1fA86b53e8e101c93c570f276bC5177832bd031). A bare implementation
 * is inert until the ProxyAdmin owner points the proxy at it. This is a TRANSPARENT proxy, so the
 * upgrade is performed on the ProxyAdmin (0xd043f41F07e7Bc140e51971f7dd3C33AB35508AD), by its owner
 * (quantumphunks.eth), via upgradeAndCall(proxy, newImpl, 0x) — NOT upgradeToAndCall on the proxy.
 *
 * Append-only over V3 (new vars after V3's __gapV3) — validateUpgrade(V3 -> V4) enforced below.
 *
 * Broadcasts via a vanilla ethers Wallet (hardhat-ethers builds the creation tx with `to: ''`, which
 * ethers v6 rejects AFTER broadcasting — on failure check the nonce before retrying or you deploy twice).
 *
 * Dry-run by default. RUN=1 to broadcast. Uses MAINNET_PK (the burner, via .env.deploy override).
 */
import hre from 'hardhat';
import { ethers as vanillaEthers } from 'ethers';

const PROXY = '0xc1fA86b53e8e101c93c570f276bC5177832bd031';
const PROXY_ADMIN = '0xd043f41F07e7Bc140e51971f7dd3C33AB35508AD';
const LIVE = process.env.RUN === '1';

async function main() {
  const { ethers, upgrades, artifacts } = hre as any;
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  const fmt = (v: bigint) => ethers.formatEther(v);

  const V3 = await ethers.getContractFactory('EtherPhunksAuctionHouseV3');
  const V4 = await ethers.getContractFactory('EtherPhunksAuctionHouseV4');

  // Refuse to ship an implementation that isn't a layout-safe successor to the live V3.
  await upgrades.validateUpgrade(V3, V4, { kind: 'transparent' });
  console.log('validateUpgrade(V3 -> V4): PASS (append-only)');

  const art = await artifacts.readArtifact('EtherPhunksAuctionHouseV4');
  const bytecode: string = art.bytecode;
  const size = bytecode.length / 2 - 1;
  console.log(`Impl size: ${size} bytes (limit 24576)`);
  if (size > 24576) throw new Error('over EIP-170 limit');

  const fee = await ethers.provider.getFeeData();
  const bal = await ethers.provider.getBalance(me);
  const gas = await ethers.provider.estimateGas({ from: me, data: bytecode });
  const price = fee.maxFeePerGas ?? fee.gasPrice;
  const cost = gas * price;

  console.log(`\nMode:    ${LIVE ? 'LIVE BROADCAST' : 'DRY RUN (set RUN=1 to broadcast)'}`);
  console.log(`Deployer:${me}`);
  console.log(`Balance: ${fmt(bal)} ETH`);
  console.log(`Gas:     ${gas} units @ ${Number(price) / 1e9} gwei => ${fmt(cost)} ETH`);
  if (bal < cost) throw new Error('insufficient balance for deploy — fund the burner first');

  if (!LIVE) { console.log('\nDRY RUN complete. Re-run with RUN=1 to broadcast.'); return; }

  const pk = process.env.MAINNET_PK;
  if (!pk) throw new Error('MAINNET_PK not set');
  const provider = new vanillaEthers.JsonRpcProvider(
    process.env.MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com'
  );
  const wallet = new vanillaEthers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk, provider);

  const nonce = await provider.getTransactionCount(wallet.address, 'latest');
  const predicted = vanillaEthers.getCreateAddress({ from: wallet.address, nonce });
  console.log(`\npredicted address (nonce ${nonce}): ${predicted}`);
  if ((await provider.getCode(predicted)) !== '0x') {
    throw new Error(`code already exists at ${predicted} — already deployed, aborting`);
  }

  const tx = await wallet.sendTransaction({ data: bytecode });
  console.log(`creation tx: ${tx.hash}`);
  const rc = await tx.wait(2);
  const addr = rc!.contractAddress ?? predicted;

  const onchain = await ethers.provider.getCode(addr);
  console.log(`IMPLEMENTATION DEPLOYED: ${addr}`);
  console.log(`on-chain code: ${onchain.length / 2 - 1} bytes  ${onchain !== '0x' ? 'OK' : 'EMPTY!'}`);
  console.log(`\nProxy UNCHANGED. NEXT (as the ProxyAdmin owner / quantumphunks.eth on Etherscan):`);
  console.log(`  ProxyAdmin ${PROXY_ADMIN} -> Write -> upgradeAndCall(${PROXY}, ${addr}, 0x)`);
  console.log(`  then proxy ${PROXY} -> Write as Proxy -> setBuyNow2(<ethsrocks root>, 167000000000000000, true)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
