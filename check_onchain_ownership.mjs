import { createHash } from 'crypto';

const RPC = 'https://ethereum-rpc.publicnode.com';

const invalid8 = [
  { tokenId: 1569, hashId: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d' },
  { tokenId: 2103, hashId: '0x1ed45d8d35d5b5f95b3bf2e97a1c5563d665b4653ba295f0961fefb4b84e7ae3' },
  { tokenId: 3080, hashId: '0xee0cfcae35f9f839d93b21fa815b310a660b458eb1029f5a4cdc6ccd0b5bd8eb' },
  { tokenId: 3719, hashId: '0x76e22f2334637a18a94c48e4be78cd23e0c938ea37e9de7bab3848e1a8a3a03d' },
  { tokenId: 8663, hashId: '0xaf3227fa491fbbf0eb4adc1b9078fcca3ea8f2f79916f98822c89d6f702861cd' },
  { tokenId: 8699, hashId: '0x554205831931235cbee89cfc56facf1f32e9128674a522b9e2d4a6c7d9507919' },
  { tokenId: 9360, hashId: '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0' },
  { tokenId: 9363, hashId: '0xf8f8b15a6b2aebbd8cea5348c75a921ed19846aa1f31b3667b3993866ebdc573' },
];

// ESIP-2 event topic
const ESIP2_TOPIC = '0x' + createHash('sha256').update('ethscriptions_protocol_TransferEthscriptionForPreviousOwner(address,address,bytes32)').digest('hex');
// Actually use keccak256 - let's use the known topic
const TRANSFER_TOPIC = '0xf106846169727f84bfe0d625a75bdfc18ed5f1b3d1a06d63fb96cbf97284efb';

async function rpc(method, params) {
  const res = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return (await res.json()).result;
}

for (const { tokenId, hashId } of invalid8) {
  // Get mint tx
  const tx = await rpc('eth_getTransactionByHash', [hashId]);
  const mintBlock = parseInt(tx.blockNumber, 16);

  // Search for ESIP-1 transfers: txs where input = hashId (32 bytes)
  // Search for ESIP-2 events involving this hashId
  const logs = await rpc('eth_getLogs', [{
    fromBlock: '0x' + mintBlock.toString(16),
    toBlock: 'latest',
    topics: [TRANSFER_TOPIC, null, null, hashId],
  }]);

  console.log(`#${tokenId}:`);
  console.log(`  minted by: ${tx.from} (block ${mintBlock})`);
  if (logs?.length) {
    for (const log of logs) {
      const from = '0x' + log.topics[1].slice(26);
      const to = '0x' + log.topics[2].slice(26);
      console.log(`  ESIP-2 transfer: ${from} → ${to} (block ${parseInt(log.blockNumber,16)})`);
    }
  } else {
    console.log(`  no ESIP-2 transfers found`);
  }
}
