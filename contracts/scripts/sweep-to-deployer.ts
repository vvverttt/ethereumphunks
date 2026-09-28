/**
 * Sweep the hardhat signer's balance to the deployer burner.
 *
 *   FROM  0x88B6772189Dd03c4f5554eEbF3B2E0810d3f5EF8   (MAINNET_PK, overridden in .env.deploy)
 *   TO    0x10dc1ABC3E14a494C78d1e6F15185264154D5949   (PRIVATE_KEY in the repo-root .env)
 *
 * Sends balance MINUS the exact gas this transfer costs, so the source lands on zero rather
 * than leaving dust that a later sweep has to chase.
 *
 * Dry-run by default. RUN=1 to broadcast.
 */
import hre from 'hardhat';

const TO = '0x10dc1ABC3E14a494C78d1e6F15185264154D5949';
const LIVE = process.env.RUN === '1';

async function main() {
  const { ethers } = hre as any;
  const [signer] = await ethers.getSigners();
  const from = await signer.getAddress();

  const net = await ethers.provider.getNetwork();
  if (net.chainId !== 1n) throw new Error(`wrong network: ${net.chainId}`);

  const bal = await ethers.provider.getBalance(from);
  const fee = await ethers.provider.getFeeData();

  // A plain ETH transfer to an EOA is always 21,000 gas. Pay a tip, and size maxFee off the
  // current base fee so the tx lands without overpaying.
  const gas = 21_000n;
  const tip = ethers.parseUnits('0.05', 'gwei');
  const base = fee.maxFeePerGas ?? fee.gasPrice ?? ethers.parseUnits('1', 'gwei');
  const maxFee = base + tip;
  const cost = gas * maxFee;

  console.log(`from     ${from}`);
  console.log(`to       ${TO}`);
  console.log(`balance  ${ethers.formatEther(bal)} ETH`);
  console.log(`gas      ${ethers.formatUnits(maxFee, 'gwei')} gwei x 21000 = ${ethers.formatEther(cost)} ETH`);

  if (bal <= cost) {
    console.log('\nBalance does not cover the transfer fee — nothing to sweep.');
    return;
  }
  const value = bal - cost;
  console.log(`sending  ${ethers.formatEther(value)} ETH`);

  const toBalBefore = await ethers.provider.getBalance(TO);
  console.log(`\ndestination before  ${ethers.formatEther(toBalBefore)} ETH`);
  console.log(`destination after   ${ethers.formatEther(toBalBefore + value)} ETH (expected)`);

  if (!LIVE) {
    console.log('\nDRY RUN — nothing broadcast. Re-run with RUN=1 to send.');
    return;
  }

  const tx = await signer.sendTransaction({
    to: TO, value, gasLimit: gas, maxFeePerGas: maxFee, maxPriorityFeePerGas: tip,
  });
  console.log(`\ntx: ${tx.hash}`);
  await tx.wait();

  const [a, b] = await Promise.all([
    ethers.provider.getBalance(from), ethers.provider.getBalance(TO),
  ]);
  console.log(`source      ${ethers.formatEther(a)} ETH`);
  console.log(`destination ${ethers.formatEther(b)} ETH`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
