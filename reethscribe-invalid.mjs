import { createWalletClient, createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('./contracts/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);
const sbEnv = Object.fromEntries(
  readFileSync('./indexer/.env', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);

const sb = createClient(sbEnv.SUPABASE_URL, sbEnv.SUPABASE_SERVICE_ROLE);
const RPC = 'https://ethereum-rpc.publicnode.com';

const account = privateKeyToAccount(`0x${env.MAINNET_PK}`);
const walletClient = createWalletClient({ account, chain: mainnet, transport: http(RPC) });
const publicClient = createPublicClient({ chain: mainnet, transport: http(RPC) });

console.log(`Signer: ${account.address}`);

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

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const { result, error } = await res.json();
  if (error) throw new Error(`RPC error: ${error.message}`);
  return result;
}

// Load JSON for updating
const jsonPath = 'C:/Users/alber/OneDrive/Desktop/market/ethereumphunks/New folder/1 - CryptoPhunksV67.json';
const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'));

const results = [];

for (const { tokenId, hashId: oldHashId } of invalid8) {
  console.log(`\n#${tokenId} — re-ethscribing...`);

  // Fetch original tx input
  const tx = await rpc('eth_getTransactionByHash', [oldHashId]);
  if (!tx) { console.log(`  SKIP: old tx not found`); continue; }
  const inputHex = tx.input; // includes 0x prefix

  // Send new self-to-self tx with same data
  const newHashId = await walletClient.sendTransaction({
    to: account.address,
    data: inputHex,
    gas: 200000n,
  });
  console.log(`  sent: ${newHashId}`);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({ hash: newHashId });
  console.log(`  confirmed block: ${receipt.blockNumber}`);

  // Compute SHA from input
  const inputBytes = Buffer.from(inputHex.slice(2), 'hex');
  const sha = createHash('sha256').update(inputBytes).digest('hex');

  results.push({ tokenId, oldHashId, newHashId, sha, blockNumber: Number(receipt.blockNumber) });

  // Update Supabase — replace hashId
  const { error } = await sb.from('ethscriptions')
    .update({ hashId: newHashId, oldHashId: oldHashId })
    .eq('hashId', oldHashId);
  if (error) console.error(`  Supabase update error: ${error.message}`);
  else console.log(`  Supabase updated`);

  // Small delay between txs
  await new Promise(r => setTimeout(r, 2000));
}

// Update JSON file
for (const { tokenId, oldHashId, newHashId } of results) {
  const item = jsonData.collection_items.find(x => x.id?.toLowerCase() === oldHashId.toLowerCase());
  if (!item) { console.log(`#${tokenId}: NOT FOUND in JSON`); continue; }
  item.id = newHashId;
  console.log(`\nJSON #${tokenId}: ${oldHashId.slice(0,20)}... → ${newHashId.slice(0,20)}...`);
}
writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));

console.log('\n=== DONE ===');
console.log('Results:');
for (const r of results) {
  console.log(`  #${r.tokenId}: ${r.oldHashId} → ${r.newHashId}`);
}
