/**
 * Deploy the EtherPhunksAuctionHouseV3 IMPLEMENTATION only.
 *
 * This does NOT touch the live proxy (0xc1fA86b53e8e101c93c570f276bC5177832bd031). A bare
 * implementation is inert until the ProxyAdmin owner points the proxy at it — the upgrade is
 * performed by quantumphunks.eth on Etherscan.
 *
 * DEPLOYED 2026-07-17: implementation = 0x579ccf18bdB09e48982F8578887Eb3bcb39a9f59
 * (solc 0.8.36, 14943 bytes deployed, initialisers disabled, bytecode verified exact match).
 *
 * Broadcasts via a vanilla ethers Wallet, NOT hardhat-ethers. Both hardhat-ethers'
 * factory.deploy() and signer.sendTransaction({data}) build the creation tx with `to: ''`
 * (empty string) instead of omitting it, which ethers v6 rejects with
 * `invalid value for value.to`. Note the raw tx still BROADCASTS before that error is thrown —
 * so on failure, always check the nonce before retrying or you will deploy twice.
 *
 * Dry-run by default. RUN=1 to broadcast.
 */
import hre from 'hardhat';
import { ethers as vanillaEthers } from 'ethers';

const LIVE = process.env.RUN === '1';

async function main() {
  const { ethers, upgrades, artifacts } = hre as any;
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  const fmt = (v: bigint) => ethers.formatEther(v);

  const V3 = await ethers.getContractFactory('EtherPhunksAuctionHouseV3');

  // Refuse to ship an implementation that isn't a layout-safe successor to the live V2.
  const V2 = await ethers.getContractFactory('EtherPhunksAuctionHouseV2');
  await upgrades.validateUpgrade(V2, V3, { kind: 'transparent' });
  console.log('validateUpgrade(V2 -> V3): PASS (append-only)');

  const art = await artifacts.readArtifact('EtherPhunksAuctionHouseV3');
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
  if (bal < cost) throw new Error('insufficient balance for deploy');

  if (!LIVE) { console.log('\nDRY RUN complete. Re-run with RUN=1 to broadcast.'); return; }

  // Vanilla ethers wallet — bypasses the hardhat-ethers `to: ''` creation-tx bug (see header).
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
  console.log(`gas used: ${rc.gasUsed}  cost: ${fmt(rc.gasUsed * rc.gasPrice)} ETH`);
  console.log(`\nProxy is UNCHANGED — still running V2 until you upgrade on Etherscan.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
