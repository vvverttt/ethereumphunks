/**
 * Sweep the deployer burner's balance to quantumphunks.eth.
 *
 *   FROM  0x10dc1ABC3E14a494C78d1e6F15185264154D5949   (PRIVATE_KEY in the repo-root .env)
 *   TO    quantumphunks.eth                            (resolved live, then checked)
 *
 * Sends balance MINUS the exact gas this transfer costs, so the burner lands on zero rather
 * than leaving dust for a later sweep to chase.
 *
 * The destination is resolved from ENS and then verified against the expected address, rather
 * than trusting either alone: a hardcoded address can go stale if the name is repointed, and a
 * bare ENS lookup would follow it silently. Disagreement aborts.
 *
 * Dry-run by default. RUN=1 to broadcast.
 */
import hre from 'hardhat';
import fs from 'fs';
import path from 'path';
import { ethers as vanillaEthers } from 'ethers';

const ENS = 'quantumphunks.eth';
const EXPECTED = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';
const DEPLOYER = '0x10dc1ABC3E14a494C78d1e6F15185264154D5949';
const LIVE = process.env.RUN === '1';

function burnerKey(): string {
  const p = path.join(__dirname, '..', '..', '.env');
  const m = fs.readFileSync(p, 'utf8').match(/^PRIVATE_KEY=(0x)?([a-fA-F0-9]{64})$/m);
  if (!m) throw new Error(`PRIVATE_KEY not found in ${p}`);
  return '0x' + m[2];
}

async function main() {
  const { ethers } = hre as any;
  const net = await ethers.provider.getNetwork();
  if (net.chainId !== 1n) throw new Error(`wrong network: ${net.chainId}`);

  const wallet = new vanillaEthers.Wallet(burnerKey(), ethers.provider);
  const from = wallet.address;
  if (from.toLowerCase() !== DEPLOYER.toLowerCase()) {
    throw new Error(`root .env PRIVATE_KEY is ${from}, expected the deployer ${DEPLOYER}`);
  }

  // hardhat-ethers' provider does not implement resolveName, so the ENS lookup uses a vanilla
  // provider pointed at the same RPC.
  const ensProvider = new vanillaEthers.JsonRpcProvider(
    process.env.MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com', 1, { staticNetwork: true },
  );
  const resolved = await ensProvider.resolveName(ENS);
  if (!resolved) throw new Error(`${ENS} did not resolve`);
  if (resolved.toLowerCase() !== EXPECTED.toLowerCase()) {
    throw new Error(`${ENS} resolves to ${resolved}, expected ${EXPECTED} — ABORTING`);
  }
  const to = resolved;

  const bal = await ethers.provider.getBalance(from);
  const fee = await ethers.provider.getFeeData();

  // A plain ETH transfer to an EOA is always 21,000 gas.
  const gas = 21_000n;
  const tip = ethers.parseUnits('0.05', 'gwei');
  const base = fee.maxFeePerGas ?? fee.gasPrice ?? ethers.parseUnits('1', 'gwei');
  const maxFee = base + tip;
  const cost = gas * maxFee;

  console.log(`from     ${from}`);
  console.log(`to       ${to}  (${ENS})`);
  console.log(`balance  ${ethers.formatEther(bal)} ETH`);
  console.log(`gas      ${ethers.formatUnits(maxFee, 'gwei')} gwei x 21000 = ${ethers.formatEther(cost)} ETH`);

  if (bal <= cost) { console.log('\nBalance does not cover the fee — nothing to sweep.'); return; }
  const value = bal - cost;
  console.log(`sending  ${ethers.formatEther(value)} ETH`);

  const toBefore = await ethers.provider.getBalance(to);
  console.log(`\ndestination before  ${ethers.formatEther(toBefore)} ETH`);
  console.log(`destination after   ${ethers.formatEther(toBefore + value)} ETH (expected)`);

  if (!LIVE) { console.log('\nDRY RUN — nothing broadcast. Re-run with RUN=1 to send.'); return; }

  const tx = await wallet.sendTransaction({
    to, value, gasLimit: gas, maxFeePerGas: maxFee, maxPriorityFeePerGas: tip,
  });
  console.log(`\ntx: ${tx.hash}`);
  await tx.wait();

  const [a, b] = await Promise.all([ethers.provider.getBalance(from), ethers.provider.getBalance(to)]);
  console.log(`source      ${ethers.formatEther(a)} ETH`);
  console.log(`destination ${ethers.formatEther(b)} ETH`);
}

main().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
