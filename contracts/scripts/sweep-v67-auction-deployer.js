// Sweep the V67 auction deployer burner's leftover ETH to quantumphunks.eth. Key never printed.
const fs = require('fs'), path = require('path'), os = require('os');
require('dotenv').config();
const ENV = process.env.V67_AUCTION_ENV || path.join(os.homedir(), '.secrets', 'v67-auction-deploy.env');
require('dotenv').config({ path: ENV, override: true });
const { ethers } = require('ethers');
const TO = '0x19d57A31b982d3d75c16358795A4D19c803e4A72'; // quantumphunks.eth
(async () => {
  const p = new ethers.JsonRpcProvider(process.env.MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com');
  const w = new ethers.Wallet(process.env.MAINNET_PK.replace(/^0x/, ''), p);
  if (w.address !== ethers.getAddress(process.env.DEPLOYER_ADDRESS)) throw new Error('key/address mismatch');
  const bal = await p.getBalance(w.address);
  const base = (await p.getBlock('latest')).baseFeePerGas;
  const tip = 1_000_000n; // 0.001 gwei
  const maxFee = base * 2n + tip;
  const cost = 21_000n * maxFee;
  if (bal <= cost) { console.log('nothing worth sweeping', ethers.formatEther(bal)); return; }
  const tx = await w.sendTransaction({ to: TO, value: bal - cost, gasLimit: 21_000n, maxFeePerGas: maxFee, maxPriorityFeePerGas: tip });
  console.log('sweep tx', tx.hash, 'value', ethers.formatEther(bal - cost));
  const r = await tx.wait();
  console.log('status', r.status, 'left', ethers.formatEther(await p.getBalance(w.address)));
})().catch((e) => { console.error(e.message); process.exit(1); });
