import { createHash } from 'crypto';

const ALCHEMY = 'https://ethereum-rpc.publicnode.com';

const invalid8 = [
  { hashId: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d', tokenId: 1569 },
  { hashId: '0x1ed45d8d35d5b5f95b3bf2e97a1c5563d665b4653ba295f0961fefb4b84e7ae3', tokenId: 2103 },
  { hashId: '0xee0cfcae35f9f839d93b21fa815b310a660b458eb1029f5a4cdc6ccd0b5bd8eb', tokenId: 3080 },
  { hashId: '0x76e22f2334637a18a94c48e4be78cd23e0c938ea37e9de7bab3848e1a8a3a03d', tokenId: 3719 },
  { hashId: '0xaf3227fa491fbbf0eb4adc1b9078fcca3ea8f2f79916f98822c89d6f702861cd', tokenId: 8663 },
  { hashId: '0x554205831931235cbee89cfc56facf1f32e9128674a522b9e2d4a6c7d9507919', tokenId: 8699 },
  { hashId: '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0', tokenId: 9360 },
  { hashId: '0xf8f8b15a6b2aebbd8cea5348c75a921ed19846aa1f31b3667b3993866ebdc573', tokenId: 9363 },
];

async function rpc(method, params) {
  const res = await fetch(ALCHEMY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const { result, error } = await res.json();
  if (error) throw new Error(`RPC error: ${error.message}`);
  return result;
}

for (const { hashId, tokenId } of invalid8) {
  const tx = await rpc('eth_getTransactionByHash', [hashId]);
  if (!tx) { console.log(`#${tokenId}: TX NOT FOUND`); continue; }

  const input = tx.input;
  const inputBytes = Buffer.from(input.slice(2), 'hex');
  const sha = createHash('sha256').update(inputBytes).digest('hex');
  const mimePrefix = inputBytes.toString('utf8').slice(0, 35);
  const isSelfToSelf = tx.from?.toLowerCase() === tx.to?.toLowerCase();

  console.log(`#${tokenId} (block ${parseInt(tx.blockNumber, 16)}, txIndex ${parseInt(tx.transactionIndex, 16)})`);
  console.log(`  from=to: ${isSelfToSelf} | mime: ${mimePrefix}`);
  console.log(`  sha256: ${sha}`);
  console.log(`  input size: ${inputBytes.length} bytes`);

  // Check if there's any earlier tx from the same sender with same content
  // using alchemy_getAssetTransfers won't work, but we can check
  // eth_getTransactionCount at that block to understand context
  await new Promise(r => setTimeout(r, 200));
}
