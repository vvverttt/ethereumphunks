/**
 * Deploy the CryptoPhunksV67V2 IMPLEMENTATION only.
 *
 * This does NOT touch the live proxy (0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3). A bare
 * implementation is inert until the owner points the proxy at it, which is done on Etherscan.
 *
 * What V2 changes: blocking an operator (and turning the whitelist on) now voids approvals the
 * operator ALREADY holds, instead of only stopping new ones. Makes the control reversible.
 *
 * Broadcasts via a vanilla ethers Wallet, NOT hardhat-ethers. hardhat-ethers builds the
 * creation tx with `to: ''` instead of omitting it, which ethers v6 rejects — and the raw tx
 * still BROADCASTS before the error is thrown, so on any failure check the nonce before
 * retrying or you will deploy twice.
 *
 * Dry-run by default. RUN=1 to broadcast.
 */
import hre from 'hardhat';
import fs from 'fs';
import path from 'path';
import { ethers as vanillaEthers } from 'ethers';

const PROXY = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';
const NAME = 'contracts/V2MainnetUpgrade/QuantumPhunksMarket/QuantumPhunksNFTV2.sol:CryptoPhunksV67V2';
const DEPLOYER = '0x10dc1ABC3E14a494C78d1e6F15185264154D5949';
const LIVE = process.env.RUN === '1';

/**
 * The deployer is the burner, whose key is PRIVATE_KEY in the REPO-ROOT .env.
 *
 * Not hardhat's signer: hardhat.config runs dotenv from contracts/, so it picks up
 * contracts/.env and then contracts/.env.deploy, which override MAINNET_PK to a different
 * wallet entirely. Reading the root file directly keeps the deployer explicit instead of
 * whichever address that chain of overrides happens to resolve to.
 */
function burnerKey(): string {
  const p = path.join(__dirname, '..', '..', '.env');
  const env = fs.readFileSync(p, 'utf8');
  const m = env.match(/^PRIVATE_KEY=(0x)?([a-fA-F0-9]{64})$/m);
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

  // Refuse to ship an implementation that is not a layout-safe successor to what is live.
  // The proxy was deployed outside the upgrades plugin, so it has to be imported first or
  // validateUpgrade fails with "not registered" — a bookkeeping error, not a layout one.
  const Flip = await ethers.getContractFactory(
    'contracts/V2MainnetUpgrade/QuantumPhunksMarket/QuantumPhunksNFTFlip.sol:CryptoPhunksV67Flip',
  );
  try { await upgrades.forceImport(PROXY, Flip, { kind: 'uups' }); } catch { /* already imported */ }

  const V2 = await ethers.getContractFactory(NAME);
  await upgrades.validateUpgrade(PROXY, V2, { kind: 'uups' });
  console.log('validateUpgrade: PASS (storage layout compatible)');

  const art = await artifacts.readArtifact(NAME);
  const size = art.deployedBytecode.length / 2 - 1;
  console.log(`impl size: ${size} bytes (limit 24576)`);
  if (size > 24576) throw new Error('over the contract size limit');

  const bal = await ethers.provider.getBalance(me);
  const fee = await ethers.provider.getFeeData();
  const gas = 3_200_000n;                       // generous; actual is well under
  const cost = gas * (fee.maxFeePerGas ?? fee.gasPrice ?? 0n);
  console.log(`deployer:  ${me}`);
  console.log(`balance:   ${ethers.formatEther(bal)} ETH`);
  console.log(`gas price: ${ethers.formatUnits(fee.maxFeePerGas ?? fee.gasPrice ?? 0n, 'gwei')} gwei`);
  console.log(`max cost:  ~${ethers.formatEther(cost)} ETH`);

  if (!LIVE) {
    console.log('\nDRY RUN — nothing broadcast. Re-run with RUN=1 to deploy.');
    return;
  }
  if (bal < cost) throw new Error('insufficient balance for the deploy');

  const factory = new vanillaEthers.ContractFactory(art.abi, art.bytecode, wallet);
  const tx = await factory.getDeployTransaction();
  const sent = await wallet.sendTransaction({ data: tx.data, gasLimit: gas });
  console.log(`\ntx: ${sent.hash}`);
  const rcpt = await sent.wait();
  console.log(`implementation deployed: ${rcpt!.contractAddress}`);

  console.log('\nNext, from the owner wallet on Etherscan (Write as Proxy on the NFT):');
  console.log(`  upgradeToAndCall(${rcpt!.contractAddress}, 0x)`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
