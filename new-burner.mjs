// Generate a fresh burner for the v67 populate run.
//
// Prints the ADDRESS only. The private key is written to gitignored files and is never
// echoed to the terminal, a log, or a tool result — the address is all anyone needs to
// fund it or transfer ownership to it.
//
// Refuses to run if the destination files are not gitignored, and refuses to overwrite an
// existing burner without first copying it aside.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Wallet, JsonRpcProvider, formatEther } = require('./contracts/node_modules/ethers');
import fs from 'fs';
import { execSync } from 'child_process';

const KEYFILE = '.burner-v67';
const ENVFILE = '.env';
const stamp = new Date().toISOString().slice(0, 10);
const BACKUP = `.burner-v67-old-${stamp}`;

// ── refuse to write a secret anywhere git can see it ──
for (const f of [KEYFILE, ENVFILE, BACKUP]) {
  try { execSync(`git check-ignore -q ${f}`, { stdio: 'ignore' }); }
  catch { console.error(`ABORT: ${f} is NOT gitignored. Add it to .gitignore before running this.`); process.exit(1); }
}
try {
  const tracked = execSync(`git ls-files ${KEYFILE} ${ENVFILE}`, { encoding: 'utf8' }).trim();
  if (tracked) { console.error(`ABORT: already tracked by git: ${tracked}`); process.exit(1); }
} catch {}

// ── keep the old one ──
let oldAddr = null;
if (fs.existsSync(KEYFILE)) {
  const prev = fs.readFileSync(KEYFILE, 'utf8').trim();
  oldAddr = new Wallet(prev).address;
  if (fs.existsSync(BACKUP)) { console.error(`ABORT: ${BACKUP} already exists — not clobbering a backup.`); process.exit(1); }
  fs.writeFileSync(BACKUP, prev, { mode: 0o600 });
  console.log(`old burner kept  -> ${BACKUP}`);
  console.log(`  its address:      ${oldAddr}`);
}

// ── new key ──
const w = Wallet.createRandom();
fs.writeFileSync(KEYFILE, w.privateKey, { mode: 0o600 });

// .env gets it under the name the writer already reads (process.env.PRIVATE_KEY).
let env = fs.existsSync(ENVFILE) ? fs.readFileSync(ENVFILE, 'utf8') : '';
const line = `PRIVATE_KEY=${w.privateKey}`;
env = /^PRIVATE_KEY=.*$/m.test(env)
  ? env.replace(/^PRIVATE_KEY=.*$/m, line)
  : (env && !env.endsWith('\n') ? env + '\n' : env) + `# v67 populate burner, generated ${stamp}\n${line}\n`;
if (oldAddr) {
  const note = `# previous burner ${oldAddr} -> ${BACKUP}`;
  if (!env.includes(note)) env = env.replace(line, `${note}\n${line}`);
}
fs.writeFileSync(ENVFILE, env, { mode: 0o600 });

console.log(`\nNEW BURNER`);
console.log(`  address   ${w.address}`);
console.log(`  key       written to ${KEYFILE} and ${ENVFILE} (both gitignored, not printed)`);

const p = new JsonRpcProvider(process.env.RPC_URL || 'https://ethereum-rpc.publicnode.com', 1, { staticNetwork: true });
console.log(`  balance   ${formatEther(await p.getBalance(w.address))} ETH   nonce ${await p.getTransactionCount(w.address)}`);

console.log(`\nsend to this address:`);
console.log(`  1. ETH for gas — 0.08 covers the full 1,054 run at 0.08 gwei`);
console.log(`  2. ownership of CryptoPhunksV67 0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3`);
console.log(`     (transferOwnership from quantumphunks.eth — setters are onlyOwner)`);
