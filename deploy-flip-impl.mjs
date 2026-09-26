// Deploy the CryptoPhunksV67Flip implementation. Deployment only — this does NOT touch
// the proxy, so until upgradeToAndCall is sent the live collection is unaffected and a
// bad deploy costs nothing but gas.
//
// Vanilla ethers on purpose: hardhat-ethers has a creation-tx bug that broadcasts and
// then throws, which makes it look like a failure after the money is spent.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JsonRpcProvider, Wallet, ContractFactory, keccak256, formatEther, formatUnits, parseUnits } = require('./contracts/node_modules/ethers');
require('./contracts/node_modules/dotenv').config();
import fs from 'fs';

const ART = 'C:/Users/alber/AppData/Local/Temp/ethereumphunks-hardhat/artifacts/contracts/V2MainnetUpgrade/QuantumPhunksMarket/QuantumPhunksNFTFlip.sol/CryptoPhunksV67Flip.json';
const MAX_GWEI = Number(process.env.MAX_GWEI || 0.09);
const RUN = process.env.RUN === '1';

const art = JSON.parse(fs.readFileSync(ART, 'utf8'));
const p = new JsonRpcProvider(process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com', 1, { staticNetwork: true });
const w = new Wallet(process.env.PRIVATE_KEY, p);

console.log(`deploying CryptoPhunksV67Flip`);
console.log(`  from    ${w.address}`);
console.log(`  runtime ${(art.deployedBytecode.length - 2) / 2} bytes`);

const blk = await p.getBlock('latest');
const base = blk.baseFeePerGas;
const gwei = Number(formatUnits(base, 'gwei'));
console.log(`  baseFee ${gwei.toFixed(4)} gwei (cap ${MAX_GWEI})`);
if (gwei > MAX_GWEI) { console.error(`ABORT: over cap`); process.exit(1); }

if (!RUN) { console.log('\nDRY RUN — nothing sent. Re-run with RUN=1.'); process.exit(0); }

const tip = parseUnits('0.001', 'gwei');
const cap = parseUnits(String(MAX_GWEI), 'gwei');
const want = base * 2n + tip;
const factory = new ContractFactory(art.abi, art.bytecode, w);
const tx = await factory.getDeployTransaction();
const gas = await p.estimateGas({ from: w.address, data: tx.data });

const sent = await w.sendTransaction({
  data: tx.data, gasLimit: (gas * 12n) / 10n,
  maxFeePerGas: want > cap ? cap : want, maxPriorityFeePerGas: tip,
});
console.log(`\n  ${sent.hash} …`);
const r = await sent.wait(1);
if (r.status !== 1) { console.error('  REVERTED'); process.exit(1); }

const impl = r.contractAddress;
console.log(`  ok  ${r.gasUsed} gas  ${formatEther(r.gasUsed * r.gasPrice)} ETH`);
console.log(`\nIMPLEMENTATION DEPLOYED: ${impl}`);

// It must be the code we validated, not something else.
const onchain = await p.getCode(impl);
const match = keccak256(onchain) === keccak256(art.deployedBytecode);
console.log(`  bytecode matches the validated artifact: ${match ? 'YES' : 'NO — DO NOT UPGRADE TO IT'}`);
if (!match) process.exit(1);

fs.writeFileSync('./v67_new1066/flip-impl.json', JSON.stringify({
  implementation: impl, tx: sent.hash, deployedAt: new Date().toISOString(),
  runtimeBytes: (art.deployedBytecode.length - 2) / 2,
  gasUsed: r.gasUsed.toString(), costEth: formatEther(r.gasUsed * r.gasPrice),
}, null, 2));
console.log(`\nwrote v67_new1066/flip-impl.json`);
console.log(`\nthe proxy is UNCHANGED. To activate:  upgradeToAndCall(${impl}, 0x)`);
