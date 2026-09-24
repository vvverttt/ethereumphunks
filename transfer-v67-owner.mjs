// Hand CryptoPhunksV67 ownership from the burner back to quantumphunks.eth.
//
// This contract uses single-step Ownable — no acceptOwnership, no pendingOwner — so the
// transfer is immediate and the burner loses the owner-only setters the moment it lands.
// Nothing else can write images, traits or mints afterwards until ownership comes back.
//
//   dry run :  node transfer-v67-owner.mjs
//   send    :  RUN=1 node transfer-v67-owner.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JsonRpcProvider, Wallet, Contract, formatEther, formatUnits, parseUnits } = require('./contracts/node_modules/ethers');
require('./contracts/node_modules/dotenv').config();

const PROXY = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';
const TARGET_ENS = 'quantumphunks.eth';
const RUN = process.env.RUN === '1';
const MAX_GWEI = Number(process.env.MAX_GWEI || 0.14);

const provider = new JsonRpcProvider(process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com', 1, { staticNetwork: true });
const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
const c = new Contract(PROXY, [
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)',
  'function totalSupply() view returns (uint256)',
], wallet);

const to = await provider.resolveName(TARGET_ENS);
if (!to) { console.error(`ABORT: ${TARGET_ENS} did not resolve`); process.exit(1); }

const owner = await c.owner();
console.log(`contract     ${PROXY}`);
console.log(`totalSupply  ${await c.totalSupply()}`);
console.log(`current owner ${owner}`);
console.log(`signer        ${wallet.address}`);
console.log(`new owner     ${to}  (${TARGET_ENS})`);

if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
  console.error(`\nABORT: the signer is not the owner — nothing to transfer.`);
  process.exit(1);
}
if (to.toLowerCase() === owner.toLowerCase()) {
  console.log('\nalready owned by the target — nothing to do.');
  process.exit(0);
}

const data = c.interface.encodeFunctionData('transferOwnership', [to]);
const gas = await provider.estimateGas({ from: wallet.address, to: PROXY, data });
const blk = await provider.getBlock('latest');
const base = blk.baseFeePerGas;
const gwei = Number(formatUnits(base, 'gwei'));
console.log(`\ngas ${gas}  baseFee ${gwei.toFixed(4)} gwei  cost ~${(Number(gas) * gwei / 1e9).toFixed(6)} ETH`);

if (!RUN) { console.log('\nDRY RUN — nothing sent. Re-run with RUN=1.'); process.exit(0); }
if (gwei > MAX_GWEI) { console.error(`\nABORT: baseFee ${gwei.toFixed(4)} over cap ${MAX_GWEI}`); process.exit(1); }

const tip = parseUnits('0.001', 'gwei');
const cap = parseUnits(String(MAX_GWEI), 'gwei');
const want = base * 2n + tip;
const tx = await wallet.sendTransaction({ to: PROXY, data, gasLimit: gas * 12n / 10n,
  maxFeePerGas: want > cap ? cap : want, maxPriorityFeePerGas: tip });
console.log(`\n${tx.hash} …`);
const r = await tx.wait(1);
if (r.status !== 1) { console.error('REVERTED'); process.exit(1); }
console.log(`ok  ${r.gasUsed} gas  ${formatEther(r.gasUsed * r.gasPrice)} ETH`);

const now = await c.owner();
console.log(`\nowner is now ${now}`);
console.log(now.toLowerCase() === to.toLowerCase() ? 'TRANSFER CONFIRMED' : 'MISMATCH — check manually');
console.log(`burner left  ${formatEther(await provider.getBalance(wallet.address))} ETH`);
