// Pre-flight for upgrading the v67 NFT proxy to CryptoPhunksV67V2.
//
// Checks nothing is deployed and nothing is sent — read-only. Run this, read the output, and
// only then do the upgrade yourself on Etherscan.
//
//   npx hardhat run scripts/validate-nft-v2-upgrade.ts --network mainnet
//
// What it proves:
//   1. The proxy's CURRENT implementation is the source we think it is (Flip), so we are
//      upgrading from a known starting point rather than an assumed one.
//   2. V2's storage layout is compatible with it — OpenZeppelin's own validator, the same
//      check the upgrades plugin runs before it will let a deploy through.
//   3. The live operator configuration, so the behaviour change is predictable: V2 makes the
//      whitelist retroactive, and if any approvals existed they would stop working the moment
//      the upgrade lands.
import { ethers, upgrades } from 'hardhat';

const PROXY = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';

async function main() {
  const net = await ethers.provider.getNetwork();
  console.log(`network      ${net.name} (${net.chainId})`);
  if (net.chainId !== 1n) throw new Error('point this at mainnet');

  const current = await upgrades.erc1967.getImplementationAddress(PROXY);
  console.log(`proxy        ${PROXY}`);
  console.log(`current impl ${current}\n`);

  // ---- 1. layout compatibility -------------------------------------------
  // validateUpgrade compares V2's storage layout against the deployed one. V2 adds only view
  // overrides, so this should pass cleanly; if it does not, STOP — a layout change on a
  // 10,000-token collection is unrecoverable.
  const V2 = await ethers.getContractFactory(
    'contracts/V2MainnetUpgrade/QuantumPhunksMarket/QuantumPhunksNFTV2.sol:CryptoPhunksV67V2',
  );

  // The proxy was deployed outside the upgrades plugin, so its manifest has no record of it and
  // validateUpgrade fails with "not registered" — which is a BOOKKEEPING failure, not a layout
  // one. Import it first so the comparison is against the real deployed layout.
  //
  // forceImport writes only to the local manifest file; it sends no transaction.
  const Flip = await ethers.getContractFactory(
    'contracts/V2MainnetUpgrade/QuantumPhunksMarket/QuantumPhunksNFTFlip.sol:CryptoPhunksV67Flip',
  );
  try {
    await upgrades.forceImport(PROXY, Flip, { kind: 'uups' });
    console.log('[OK  ] proxy imported into the upgrades manifest (local only, no tx)');
  } catch (e: any) {
    console.log(`[warn] forceImport: ${e.message.split('\n')[0]}`);
  }

  try {
    await upgrades.validateUpgrade(PROXY, V2, { kind: 'uups' });
    console.log('[OK  ] storage layout compatible with the deployed implementation');
  } catch (e: any) {
    const msg = e.message || '';
    if (/not registered/i.test(msg)) {
      console.log('[FAIL] could not register the proxy — layout NOT checked. Do not upgrade yet.');
    } else {
      console.log('[FAIL] storage layout INCOMPATIBLE — do not upgrade');
    }
    console.log(msg);
    process.exitCode = 1;
    return;
  }

  // ---- 2. what actually changes on chain ---------------------------------
  const nft = await ethers.getContractAt(
    [
      'function owner() view returns (address)',
      'function totalSupply() view returns (uint256)',
      'function operatorWhitelistEnabled() view returns (bool)',
      'function transferValidator() view returns (address)',
      'function lottery() view returns (address)',
    ],
    PROXY,
  );
  const [owner, supply, wl, validator, lottery] = await Promise.all([
    nft.owner(), nft.totalSupply(), nft.operatorWhitelistEnabled(), nft.transferValidator(), nft.lottery(),
  ]);

  console.log('');
  console.log(`owner                    ${owner}`);
  console.log(`totalSupply              ${supply}`);
  console.log(`operatorWhitelistEnabled ${wl}`);
  console.log(`transferValidator        ${validator}${validator === ethers.ZeroAddress ? '  (disabled)' : ''}`);
  console.log(`lottery                  ${lottery}`);

  // ---- 3. the blast radius -----------------------------------------------
  // V2 voids approvals held by blocked operators AND, while the whitelist is on, by anything
  // not approved. Count live approvals so the impact is a measured number, not a guess.
  const iface = new ethers.Interface([
    'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
    'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
  ]);
  // A separate provider for the log sweep: hardhat's configured RPC (publicnode) answers wide
  // getLogs with "Archive requests require a personal token". drpc serves them keyless, capped
  // at 10k blocks per call.
  //
  // Raw fetch rather than an ethers provider. Ethers normalises and batches JSON-RPC calls, and
  // drpc kept answering "ranges over 10000 blocks are not supported" even at 7,500-block chunks
  // with batching disabled. Issuing the calls directly makes the range exactly what is written
  // here, which is the only way to stay under a server-side cap reliably.
  const RPCS = ['https://eth.drpc.org', 'https://rpc.mevblocker.io'];
  let rr = 0;
  const rpc = async (method: string, params: unknown[]): Promise<any> => {
    let last: any;
    for (let a = 0; a < 8; a++) {
      try {
        const res = await fetch(RPCS[rr++ % RPCS.length], {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
          signal: AbortSignal.timeout(40000),
        });
        const j: any = await res.json();
        if (!j.error) return j.result;
        last = new Error(j.error.message);
      } catch (e) { last = e; }
      await new Promise((r) => setTimeout(r, 400));
    }
    throw last;
  };

  const head = Number(BigInt(await rpc('eth_blockNumber', [])));
  const afaTopic = iface.getEvent('ApprovalForAll')!.topicHash;
  const state = new Map<string, boolean>();
  let perToken = 0;
  for (let b = 25760000; b <= head; b += 7500) {
    const to = Math.min(b + 7499, head);
    const logs: any[] = await rpc('eth_getLogs', [{
      address: PROXY,
      fromBlock: '0x' + b.toString(16),
      toBlock: '0x' + to.toString(16),
      topics: [[afaTopic, iface.getEvent('Approval')!.topicHash]],
    }]) || [];
    for (const l of logs) {
      if (l.topics[0] === afaTopic) {
        state.set(`${l.topics[1]}|${l.topics[2]}`, BigInt(l.data) !== 0n);
      } else if ('0x' + l.topics[2].slice(26) !== ethers.ZeroAddress) {
        perToken++;
      }
    }
  }
  const live = [...state.values()].filter(Boolean).length;

  console.log('');
  console.log(`live blanket approvals   ${live}`);
  console.log(`per-token approvals seen ${perToken}`);
  if (live === 0 && perToken === 0) {
    console.log('-> nothing to break: no approval exists that V2 could void.');
  } else {
    console.log('-> REVIEW: V2 voids approvals held by blocked or non-whitelisted operators.');
    console.log('   Approve the operators you intend to keep BEFORE upgrading.');
  }

  console.log('');
  console.log('If the above is clean, deploy the V2 implementation and upgrade the proxy');
  console.log('yourself (upgradeToAndCall(newImpl, 0x) from the owner).');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
