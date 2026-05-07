/**
 * Recover 33 ethscriptions from dystolabz wallet via Flashbots bundle.
 *
 * Bundle order (atomic, one block):
 *   TX1  – Sponsor sends EIP-7702 type-4 tx to clear drainer delegation (sponsor pays gas)
 *   TX2  – Sponsor funds dystolabz with gas money (drainer is already cleared in TX1)
 *   TX3+ – Dystolabz transfers each ethscription to safe wallet (ESIP-1: 0-ETH tx, data=hashId)
 *
 * Required env vars:
 *   DYSTOLABZ_PK   – private key of 0xEa04F65f9dC5917302532859D80fCf36a15dE266 (no 0x prefix)
 *   SPONSOR_PK     – private key of the funding wallet (no 0x prefix, needs ~0.01 ETH)
 *
 * Run:  node recover_dystolabz.mjs
 */

import { ethers } from './contracts/node_modules/ethers/lib.esm/index.js';

// ── Config ──────────────────────────────────────────────────────────────────
const DYSTOLABZ   = '0xEa04F65f9dC5917302532859D80fCf36a15dE266';
const SAFE_WALLET = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';
const CHAIN_ID    = 1n;

// Supabase (anon key is fine for reads)
const SUPABASE_URL = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe';

// RPC
const RPC_URL       = 'https://ethereum-rpc.publicnode.com';
// Flashbots relay for mainnet
const FLASHBOTS_URL = 'https://relay.flashbots.net';

// ── Helpers ──────────────────────────────────────────────────────────────────
async function rpc(method, params = []) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${JSON.stringify(json.error)}`);
  return json.result;
}

async function getGasPrices() {
  const [baseFeeHex, priorityHex] = await Promise.all([
    rpc('eth_getBlockByNumber', ['latest', false]).then(b => b.baseFeePerGas),
    rpc('eth_maxPriorityFeePerGas'),
  ]);
  const baseFee  = BigInt(baseFeeHex);
  const priority = BigInt(priorityHex);
  // 2x buffer on base fee
  const maxFee   = baseFee * 2n + priority;
  return { maxFeePerGas: maxFee, maxPriorityFeePerGas: priority };
}

// ── Supabase: fetch ethscriptions owned by dystolabz ─────────────────────────
async function fetchOwnedHashIds(owner) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/ethscriptions`);
  url.searchParams.set('select',  'hashId,tokenId,slug');
  url.searchParams.set('owner',   `eq.${owner.toLowerCase()}`);
  url.searchParams.set('limit',   '200');
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
}

// ── EIP-7702 authorization signing ───────────────────────────────────────────
// Authorization = keccak256(0x05 || rlp([chainId, delegateAddress, nonce]))
// Signed by the account being delegated.
// Set delegateAddress = 0x0000...0000 to clear existing delegation.
function signEIP7702Auth(wallet, chainId, delegateAddress, nonce) {
  // Encode with ethers RLP: values must be hex strings (no leading zeros) or 0x
  const toHexNum = (n) => n === 0n ? '0x' : ethers.toBeHex(n);

  const encoded = ethers.encodeRlp([
    toHexNum(chainId),
    delegateAddress === ethers.ZeroAddress ? '0x' : delegateAddress,
    toHexNum(BigInt(nonce)),
  ]);

  const magic   = '0x05';
  const payload = ethers.concat([magic, encoded]);
  const hash    = ethers.keccak256(payload);

  const sigObj  = wallet.signingKey.sign(hash);
  return {
    chainId,
    address: delegateAddress,
    nonce:   BigInt(nonce),
    yParity: sigObj.yParity,
    r:       sigObj.r,
    s:       sigObj.s,
  };
}

// ── Serialize & sign EIP-7702 type-4 transaction ─────────────────────────────
// Type-4 serialization:
//   0x04 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit,
//                to, value, data, accessList,
//                authorizationList])
// Each auth entry: [chainId, address, nonce, yParity, r, s]
function serializeEIP7702Tx(tx) {
  const toHexNum = (n) => {
    const bn = BigInt(n);
    return bn === 0n ? '0x' : ethers.toBeHex(bn);
  };

  const authList = tx.authorizationList.map(a => [
    toHexNum(a.chainId),
    a.address === ethers.ZeroAddress ? '0x' : a.address,
    toHexNum(a.nonce),
    toHexNum(BigInt(a.yParity)),
    a.r,
    a.s,
  ]);

  const fields = [
    toHexNum(tx.chainId),
    toHexNum(tx.nonce),
    toHexNum(tx.maxPriorityFeePerGas),
    toHexNum(tx.maxFeePerGas),
    toHexNum(tx.gasLimit),
    tx.to ?? '0x',
    toHexNum(tx.value ?? 0n),
    tx.data ?? '0x',
    tx.accessList ?? [],
    authList,
  ];

  return ethers.concat(['0x04', ethers.encodeRlp(fields)]);
}

function signEIP7702Tx(wallet, tx) {
  const unsigned = serializeEIP7702Tx(tx);
  const hash = ethers.keccak256(unsigned);
  const sig  = wallet.signingKey.sign(hash);

  const signed = [
    ...ethers.decodeRlp(ethers.dataSlice(unsigned, 1)),
    ethers.toBeHex(BigInt(sig.yParity)),
    sig.r,
    sig.s,
  ];
  return ethers.concat(['0x04', ethers.encodeRlp(signed)]);
}

// Standard EIP-1559 (type 2) transaction serialization
function signEIP1559Tx(wallet, tx) {
  const toHexNum = (n) => {
    const bn = BigInt(n);
    return bn === 0n ? '0x' : ethers.toBeHex(bn);
  };

  const fields = [
    toHexNum(tx.chainId),
    toHexNum(tx.nonce),
    toHexNum(tx.maxPriorityFeePerGas),
    toHexNum(tx.maxFeePerGas),
    toHexNum(tx.gasLimit),
    tx.to ?? '0x',
    toHexNum(tx.value ?? 0n),
    tx.data ?? '0x',
    tx.accessList ?? [],
  ];

  const unsigned = ethers.concat(['0x02', ethers.encodeRlp(fields)]);
  const hash = ethers.keccak256(unsigned);
  const sig  = wallet.signingKey.sign(hash);

  const signed = [
    ...ethers.decodeRlp(ethers.dataSlice(unsigned, 1)),
    ethers.toBeHex(BigInt(sig.yParity)),
    sig.r,
    sig.s,
  ];
  return ethers.concat(['0x02', ethers.encodeRlp(signed)]);
}

// ── Flashbots bundle submission ───────────────────────────────────────────────
async function sendFlashbotsBundle(signedTxs, sponsorWallet, blockNumber) {
  const txHashes = signedTxs.map(tx => ethers.keccak256(tx));

  const bundle = {
    jsonrpc: '2.0',
    id:      1,
    method:  'eth_sendBundle',
    params:  [{
      txs:         signedTxs,
      blockNumber: ethers.toBeHex(BigInt(blockNumber)),
    }],
  };

  const body    = JSON.stringify(bundle);
  const bodyHex = ethers.id(body); // keccak256 of the body

  // Flashbots requires X-Flashbots-Signature header
  const sponsorMsg = `${sponsorWallet.address}:${bodyHex}`;
  const sig         = await sponsorWallet.signMessage(sponsorMsg);

  const res = await fetch(FLASHBOTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type':          'application/json',
      'X-Flashbots-Signature': `${sponsorWallet.address}:${sig}`,
    },
    body,
  });
  return res.json();
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Load wallets
  const dystolabzPk = process.env.DYSTOLABZ_PK;
  const sponsorPk   = process.env.SPONSOR_PK;

  if (!dystolabzPk || !sponsorPk) {
    console.error('ERROR: Set DYSTOLABZ_PK and SPONSOR_PK env vars (no 0x prefix)');
    process.exit(1);
  }

  const dystolabzWallet = new ethers.Wallet(`0x${dystolabzPk}`);
  const sponsorWallet   = new ethers.Wallet(`0x${sponsorPk}`);

  if (dystolabzWallet.address.toLowerCase() !== DYSTOLABZ.toLowerCase()) {
    console.error(`ERROR: DYSTOLABZ_PK does not match expected address ${DYSTOLABZ}`);
    console.error(`       Got: ${dystolabzWallet.address}`);
    process.exit(1);
  }

  console.log('Dystolabz wallet:', dystolabzWallet.address);
  console.log('Sponsor wallet:  ', sponsorWallet.address);
  console.log('Safe wallet:     ', SAFE_WALLET);
  console.log('');

  // 2. Fetch ethscriptions owned by dystolabz from Supabase
  console.log('Fetching ethscriptions owned by dystolabz from Supabase...');
  const items = await fetchOwnedHashIds(DYSTOLABZ);
  if (!Array.isArray(items) || items.length === 0) {
    console.error('No ethscriptions found in DB for', DYSTOLABZ);
    console.error('Response:', items);
    process.exit(1);
  }
  console.log(`Found ${items.length} ethscription(s):\n`);
  for (const item of items) {
    console.log(`  #${item.tokenId} [${item.slug}] ${item.hashId}`);
  }
  console.log('');

  // 3. Get current nonces & gas prices
  const [dystolabzNonceHex, sponsorNonceHex, latestBlockHex] = await Promise.all([
    rpc('eth_getTransactionCount', [DYSTOLABZ,   'pending']),
    rpc('eth_getTransactionCount', [sponsorWallet.address, 'pending']),
    rpc('eth_blockNumber'),
  ]);
  const dystolabzNonce = Number(BigInt(dystolabzNonceHex));
  const sponsorNonce   = Number(BigInt(sponsorNonceHex));
  const latestBlock    = Number(BigInt(latestBlockHex));
  const targetBlock    = latestBlock + 2; // submit for next 2 blocks

  console.log(`Dystolabz nonce: ${dystolabzNonce}`);
  console.log(`Sponsor nonce:   ${sponsorNonce}`);
  console.log(`Latest block:    ${latestBlock} → targeting block ${targetBlock}`);
  console.log('');

  const gas = await getGasPrices();
  console.log(`Gas: maxFeePerGas=${ethers.formatUnits(gas.maxFeePerGas,'gwei')} gwei, priority=${ethers.formatUnits(gas.maxPriorityFeePerGas,'gwei')} gwei`);
  console.log('');

  // 4. Build TX1: EIP-7702 clear delegation (sponsor pays, sets dystolabz code to 0x)
  console.log('Building TX1: EIP-7702 clear delegation...');
  const auth = signEIP7702Auth(dystolabzWallet, CHAIN_ID, ethers.ZeroAddress, dystolabzNonce);

  const tx1 = signEIP7702Tx(sponsorWallet, {
    chainId:              CHAIN_ID,
    nonce:                BigInt(sponsorNonce),
    maxPriorityFeePerGas: gas.maxPriorityFeePerGas,
    maxFeePerGas:         gas.maxFeePerGas,
    gasLimit:             100_000n,
    to:                   DYSTOLABZ,   // destination = dystolabz (required for type-4)
    value:                0n,
    data:                 '0x',
    authorizationList:    [auth],
  });
  console.log('TX1 built:', ethers.keccak256(tx1));

  // 5. Build TX2: Fund dystolabz with gas money (0.005 ETH = enough for ~33 txs at 5 gwei)
  const GAS_PER_TRANSFER = 30_000n;
  const gasNeeded = GAS_PER_TRANSFER * BigInt(items.length) * gas.maxFeePerGas;
  const fundAmount = gasNeeded + ethers.parseEther('0.0005'); // small buffer

  console.log(`Building TX2: Fund dystolabz with ${ethers.formatEther(fundAmount)} ETH...`);
  const tx2 = signEIP1559Tx(sponsorWallet, {
    chainId:              CHAIN_ID,
    nonce:                BigInt(sponsorNonce + 1),
    maxPriorityFeePerGas: gas.maxPriorityFeePerGas,
    maxFeePerGas:         gas.maxFeePerGas,
    gasLimit:             21_000n,
    to:                   DYSTOLABZ,
    value:                fundAmount,
    data:                 '0x',
  });
  console.log('TX2 built:', ethers.keccak256(tx2));

  // 6. Build TX3+: Transfer each ethscription from dystolabz to safe wallet
  // ESIP-1: send tx with data=hashId, value=0, to=recipient, from=owner
  const transferTxs = [];
  for (let i = 0; i < items.length; i++) {
    const { hashId, tokenId, slug } = items[i];
    const tx = signEIP1559Tx(dystolabzWallet, {
      chainId:              CHAIN_ID,
      nonce:                BigInt(dystolabzNonce + i),
      maxPriorityFeePerGas: gas.maxPriorityFeePerGas,
      maxFeePerGas:         gas.maxFeePerGas,
      gasLimit:             GAS_PER_TRANSFER,
      to:                   SAFE_WALLET,
      value:                0n,
      data:                 hashId,
    });
    const hash = ethers.keccak256(tx);
    transferTxs.push(tx);
    console.log(`  TX${3 + i}: transfer #${tokenId} [${slug}] → ${hash}`);
  }
  console.log('');

  // 7. Bundle all txs
  const allSignedTxs = [tx1, tx2, ...transferTxs];
  console.log(`Bundle: ${allSignedTxs.length} transactions total`);
  console.log('');

  // 8. Check sponsor balance
  const sponsorBalHex = await rpc('eth_getBalance', [sponsorWallet.address, 'latest']);
  const sponsorBal    = BigInt(sponsorBalHex);
  const totalCost     = fundAmount + 100_000n * gas.maxFeePerGas + 21_000n * gas.maxFeePerGas;
  console.log(`Sponsor balance: ${ethers.formatEther(sponsorBal)} ETH`);
  console.log(`Estimated cost:  ${ethers.formatEther(totalCost)} ETH`);
  if (sponsorBal < totalCost) {
    console.warn('⚠ Sponsor may not have enough ETH! Proceeding anyway...');
  }
  console.log('');

  // 9. Submit bundle to Flashbots for target block (retry for 3 blocks)
  for (let block = targetBlock; block <= targetBlock + 3; block++) {
    console.log(`Submitting bundle for block ${block}...`);
    const result = await sendFlashbotsBundle(allSignedTxs, sponsorWallet, block);
    console.log('Flashbots response:', JSON.stringify(result, null, 2));

    if (result.result?.bundleHash) {
      console.log(`\n✓ Bundle submitted! Hash: ${result.result.bundleHash}`);
      console.log(`  Track at: https://blocks.flashbots.net`);
      break;
    }
    if (result.error) {
      console.error('Flashbots error:', result.error);
    }
  }

  console.log('\nDone. Check Etherscan for dystolabz outgoing txs shortly.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
