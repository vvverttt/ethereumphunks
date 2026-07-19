/**
 * Deploy the QuantumPhunksMarketMulti IMPLEMENTATION only (adds buyPhunkBatch sweep + supportsBatchBuy).
 *
 * This does NOT touch the live proxy (0xe977EaD9f08cC450FBb54B8f80D2E92b27714b44). A bare
 * implementation is inert until the owner (quantumphunks.eth) points the proxy at it via
 * upgradeToAndCall(newImpl, 0x) on Etherscan.
 *
 * The change is append-only (two new functions + one new error, ZERO storage variables), so it is
 * storage-layout-compatible with the deployed impl — validateUpgrade below enforces that.
 *
 * Broadcasts via a vanilla ethers Wallet, NOT hardhat-ethers: factory.deploy() builds the creation
 * tx with `to: ''` which ethers v6 rejects AFTER broadcasting — so on failure, check the nonce
 * before retrying or you will deploy twice. (Same bug worked around in deploy-auction-v3-impl.ts.)
 *
 * Dry-run by default. RUN=1 to broadcast.
 */
import hre from 'hardhat';
import { ethers as vanillaEthers } from 'ethers';

const PROXY = '0xe977EaD9f08cC450FBb54B8f80D2E92b27714b44'; // QuantumPhunksMarketMulti proxy (owner: quantumphunks.eth)
const LIVE = process.env.RUN === '1';

async function main() {
  const { ethers, upgrades, artifacts } = hre as any;
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  const fmt = (v: bigint) => ethers.formatEther(v);

  const M = await ethers.getContractFactory('QuantumPhunksMarketMulti');

  // Refuse to ship an implementation that isn't a layout-safe successor to the deployed proxy.
  await upgrades.validateUpgrade(PROXY, M, { kind: 'uups' });
  console.log('validateUpgrade(proxy -> new impl): PASS (append-only, storage-compatible)');

  const art = await artifacts.readArtifact('QuantumPhunksMarketMulti');
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
  console.log(`\nProxy is UNCHANGED. NEXT (as quantumphunks.eth on Etherscan):`);
  console.log(`  ${PROXY} -> Write as Proxy -> upgradeToAndCall(${addr}, 0x)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
