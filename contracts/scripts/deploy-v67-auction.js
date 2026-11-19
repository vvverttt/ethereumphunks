/**
 * Deploy V67AuctionHouse: implementation + ERC1967 (UUPS) proxy, initialized in the same tx.
 * Vanilla ethers (dodges the hardhat-ethers contract-creation bug). Deploy only: it does NOT whitelist,
 * deposit or start. Those are separate owner/guardian steps (printed at the end).
 *
 * Required env:
 *   MAINNET_PK   deployer key (a burner; it ends up with no role)
 *   AUCTION_PAYOUT     receives every winning bid
 *   AUCTION_GUARDIAN   pause / duration / payout change / rescue / skip / deposit
 *   AUCTION_OWNER      upgrades only (the owner Safe). Set directly at init, so no handover tx.
 * Optional:
 *   MAINNET_RPC_URL (default publicnode), MAX_GWEI (default 0.075)
 *   CONFIRM_MAINNET=yes   required when the RPC is chain 1, so a mistyped RPC can't broadcast to mainnet
 *
 * Build first:  npx hardhat compile
 * Dry run:      npx hardhat node --fork <rpc>   then   MAINNET_RPC_URL=http://127.0.0.1:8545 ... node scripts/deploy-v67-auction.js
 */
const fs = require('fs'), path = require('path'), os = require('os');
require('dotenv').config();
// The burner key lives OUTSIDE the OneDrive-synced repo. override: it wins over any stale MAINNET_PK in .env.
const DEPLOY_ENV = process.env.V67_AUCTION_ENV || path.join(os.homedir(), '.secrets', 'v67-auction-deploy.env');
if (fs.existsSync(DEPLOY_ENV)) require('dotenv').config({ path: DEPLOY_ENV, override: true });
const { ethers } = require('ethers');

const RPC = process.env.MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com';
const V67 = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const MAX_GWEI = Number(process.env.MAX_GWEI || '0.075');
const CAP = ethers.parseUnits(String(MAX_GWEI), 'gwei');
const ART = path.join(process.env.TEMP || process.env.TMP, 'ethereumphunks-hardhat', 'artifacts');
const load = (p) => JSON.parse(fs.readFileSync(path.join(ART, p), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function addr(name) {
  const v = process.env[name];
  if (!v || !ethers.isAddress(v)) throw new Error(`${name} missing or not an address`);
  return ethers.getAddress(v);
}

async function fees(prov) {
  for (;;) {
    const base = (await prov.getBlock('latest')).baseFeePerGas;
    if (base <= CAP) {
      const room = CAP - base;
      return { maxFeePerGas: CAP, maxPriorityFeePerGas: room < 2_000_000n ? room : 2_000_000n };
    }
    console.log(`  base ${ethers.formatUnits(base, 'gwei')} gwei > cap ${MAX_GWEI}, waiting 30s`);
    await sleep(30_000);
  }
}

async function main() {
  const PAYOUT = addr('AUCTION_PAYOUT');
  const GUARDIAN = addr('AUCTION_GUARDIAN');
  const OWNER = addr('AUCTION_OWNER');

  const prov = new ethers.JsonRpcProvider(RPC);
  const { chainId } = await prov.getNetwork();
  if (chainId === 1n && process.env.CONFIRM_MAINNET !== 'yes') throw new Error('chain 1: set CONFIRM_MAINNET=yes to broadcast');
  const w = new ethers.Wallet(process.env.MAINNET_PK.replace(/^0x/, ''), prov);
  if (process.env.DEPLOYER_ADDRESS && w.address !== ethers.getAddress(process.env.DEPLOYER_ADDRESS)) {
    throw new Error(`key does not match DEPLOYER_ADDRESS (${w.address} vs ${process.env.DEPLOYER_ADDRESS})`);
  }

  console.log(`chain ${chainId}  deployer ${w.address}  balance ${ethers.formatEther(await prov.getBalance(w.address))} ETH`);
  console.log(`payout ${PAYOUT}\nguardian ${GUARDIAN}\nowner ${OWNER}\nnft ${V67}\nweth ${WETH}`);

  // Explicit nonces: a lagging RPC can report a stale pending count and reuse the impl tx's nonce.
  let nonce = await prov.getTransactionCount(w.address, 'latest');

  const art = load('contracts/V67AuctionHouse.sol/V67AuctionHouse.json');
  const impl = await new ethers.ContractFactory(art.abi, art.bytecode, w).deploy({ ...(await fees(prov)), nonce: nonce++ });
  const implRcpt = await impl.deploymentTransaction().wait();
  const implAddr = await impl.getAddress();
  console.log(`implementation ${implAddr}  (${implRcpt.gasUsed} gas)`);

  const init = new ethers.Interface(art.abi).encodeFunctionData('initialize', [V67, WETH, PAYOUT, GUARDIAN, OWNER]);
  const pArt = load('@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy.json');
  const proxy = await new ethers.ContractFactory(pArt.abi, pArt.bytecode, w).deploy(implAddr, init, { ...(await fees(prov)), nonce: nonce++ });
  const proxyRcpt = await proxy.deploymentTransaction().wait();
  const proxyAddr = await proxy.getAddress();
  console.log(`proxy (the auction address) ${proxyAddr}  (${proxyRcpt.gasUsed} gas)`);

  // Read back every setting from the live proxy before calling it done.
  const h = new ethers.Contract(proxyAddr, art.abi, prov);
  const checks = {
    nft: [await h.nft(), V67], weth: [await h.weth(), WETH], payout: [await h.payout(), PAYOUT],
    guardian: [await h.guardian(), GUARDIAN], owner: [await h.owner(), OWNER],
    duration: [await h.duration(), 144288n], started: [await h.started(), false],
    minOpeningBid: [await h.minOpeningBid(), ethers.parseEther('0.001')], queueEvery: [await h.queueEvery(), 2n],
    poolSinceQueue: [await h.poolSinceQueue(), 65535n],
  };
  let ok = true;
  for (const [k, [got, want]] of Object.entries(checks)) {
    const pass = String(got).toLowerCase() === String(want).toLowerCase();
    ok &&= pass;
    console.log(`  ${pass ? 'OK  ' : 'FAIL'} ${k}: ${got}`);
  }
  const implSlot = await prov.getStorage(proxyAddr, '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc');
  console.log(`  ${ethers.getAddress('0x' + implSlot.slice(26)) === implAddr ? 'OK  ' : 'FAIL'} implementation slot`);
  if (!ok) throw new Error('read-back mismatch');

  if (chainId === 1n) {
    const out = path.join(__dirname, 'generated', '_v67_auction_deploy.json');
    fs.writeFileSync(out, JSON.stringify({ proxy: proxyAddr, implementation: implAddr, payout: PAYOUT, guardian: GUARDIAN, owner: OWNER, nft: V67, weth: WETH, deployedAt: new Date().toISOString() }, null, 2));
    console.log(`saved ${out}`);
  }

  console.log(`\nNext (not done by this script):
  1. v67 owner:   setApprovedOperator(${proxyAddr}, true)   on ${V67}
  2. guardian:    setApprovalForAll(${proxyAddr}, true)     on ${V67}
  3. guardian:    deposit([...ids])  on the auction, ~250 per tx; check poolSize()
  4. (optional) featured queue for another collection. Takes turns with the v67 pool, in the order given:
       newly queued pieces go next in line, then every 2nd auction (setQueueEvery(n): 1 = back to back,
       3 = every 3rd ...). playQueueNext() puts the queue head up next regardless.
       guardian:  setCollectionAllowed(<collection>, true)
       guardian:  setApprovalForAll(${proxyAddr}, true)   on <collection>  (+ its operator whitelist, if it has one)
       guardian:  queue(<collection>, [...ids in run order], [])   ~100 per tx; [] = global length,
                  or one length per piece in seconds (0 = global, else 86400..4233600)
       reorder:   moveQueued(from, to)   retime: setQueuedDuration(pos, secs)   pull out: removeQueued(pos)
  5. owner:       start()  on the auction`);
}

main().catch((e) => { console.error(e); process.exit(1); });
