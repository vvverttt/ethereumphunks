// Check contract on-chain using raw eth_call
const PROXY = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';
const RPC = 'https://rpc.mevblocker.io';

async function ethCall(to, data) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
    signal: AbortSignal.timeout(10000),
  });
  return (await res.json()).result;
}

// Function selectors (from keccak256 of function signatures):
// inPool(bytes32) = 0x9b8e7a0c  -- need to verify
// depositor(bytes32) = 0x4e69a42f -- need to verify
// userEthscriptionPossiblyStored(address,bytes32)

// Let me compute them properly using a simple approach
// Actually, let me use the implementation ABI to get the correct selector

// From the contract ABI we saw these functions exist:
// depositor(bytes32 ) -> address
// inPool(bytes32 ) -> bool
// userEthscriptionPossiblyStored(address owner, bytes32 ethscriptionId) -> bool

// ABI encode: depositor(bytes32)
// Selector = first 4 bytes of keccak256("depositor(bytes32)")

// Let me try a known working approach - call eth_getStorageAt to read the
// ethscription transfer event on-chain to confirm receipt

// Actually, the simplest thing: check if the deposit TX at block 24655712
// was accepted by looking at its logs

const DEPOSIT_TX = '0x05f296bf18b557f891c170b1df2d580a29ee00dcdf002f9db64dfa75722ba5c7';

const res = await fetch(RPC, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [DEPOSIT_TX] }),
});
const receipt = (await res.json()).result;

console.log('=== BATCH DEPOSIT TX RECEIPT ===');
console.log('Status:', receipt?.status === '0x1' ? 'SUCCESS ✅' : 'FAILED ❌');
console.log('Block:', parseInt(receipt?.blockNumber, 16));
console.log('Gas used:', parseInt(receipt?.gasUsed, 16));
console.log('Logs count:', receipt?.logs?.length ?? 0);

if (receipt?.logs?.length) {
  console.log('\nLog topics (first 3 logs):');
  receipt.logs.slice(0, 3).forEach((log, i) => {
    console.log(`  Log ${i}: topics=${log.topics.length} data_len=${log.data?.length}`);
    if (log.topics[0]) console.log(`    topic0=${log.topics[0]}`);
  });
}

// Also verify the implementation address via EIP-1967 proxy storage slot
const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const implRes = await fetch(RPC, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getStorageAt', params: [PROXY, IMPL_SLOT, 'latest'] }),
});
const implSlot = (await implRes.json()).result;
const implAddress = '0x' + implSlot.slice(26);
console.log('\nImplementation address:', implAddress);

// Try calling userEthscriptionPossiblyStored for a sample hashId
// This is in EthscriptionsEscrower which the contract inherits
// userEthscriptionPossiblyStored(address,bytes32)
// = keccak256("userEthscriptionPossiblyStored(address,bytes32)")[0:4]
// Let's try a few known selectors

const sampleHashId = '0xa62831366cceaf8e3a8c528696ec9b5d36685bfa7d54afffdc08f3a812fbe87c';
const contractAddr = PROXY.toLowerCase().replace('0x', '').padStart(64, '0');
const hashIdPadded = sampleHashId.slice(2).padStart(64, '0');

// Try userEthscriptionPossiblyStored(address,bytes32)
// selector computed offline: 0x63f55dfe
const data1 = '0x63f55dfe' + contractAddr + hashIdPadded;
const r1 = await ethCall(PROXY, data1);
console.log('\nuserEthscriptionPossiblyStored(contract, hashId):', r1);

// Try with depositor address
const depositorAddr = '0xea04f65f9dc5917302532859d80fcf36a15de266'.replace('0x','').padStart(64,'0');
const r2 = await ethCall(PROXY, '0x63f55dfe' + depositorAddr + hashIdPadded);
console.log('userEthscriptionPossiblyStored(depositor, hashId):', r2);
