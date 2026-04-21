// Check what happened around these blocks - look at the tx details
// and whether ethscriptions.com has any record of these specific tx hashes
const items = [
  { hashId: '0x64dd2524d0dea3366884da03337fd7a4d5d66e7d7d73ad05a680213f25a1929d', tokenId: 1569, block: 24642777 },
  { hashId: '0xe02d711b4e0fa8c7fd5a14a8c0d9b0179a9410a74ac909913cca78aa63783fd0', tokenId: 9360, block: 24642915 },
  { hashId: '0x554205831931235cbee89cfc56facf1f32e9128674a522b9e2d4a6c7d9507919', tokenId: 8699, block: 24642888 },
];

for (const { hashId, tokenId, block } of items) {
  console.log(`\n#${tokenId} — block ${block}`);

  // Check tx on Blockscout
  const bs = await fetch(`https://eth.blockscout.com/api/v2/transactions/${hashId}`);
  const bsTx = await bs.json();
  const inputHex = bsTx.raw_input ?? '';
  const inputBytes = Buffer.from(inputHex.slice(2), 'hex');
  console.log(`  tx status: ${bsTx.status}, from: ${bsTx.from?.hash}, to: ${bsTx.to?.hash}`);
  console.log(`  input: ${inputBytes.toString('utf8').slice(0, 50)}... (${inputBytes.length} bytes)`);

  // Check position in block - are there earlier same-content txs in this block?
  const txIndex = bsTx.position;
  console.log(`  position in block: ${txIndex}`);

  // Check ethscriptions.com for the exact creation at this block
  // using the number endpoint
  const esNum = await fetch(`https://api.ethscriptions.com/api/ethscriptions?block_number=${block}&per_page=50`);
  const esData = await esNum.json();
  const esItems = Array.isArray(esData) ? esData : [];
  console.log(`  ethscriptions in block ${block}: ${esItems.length}`);
  for (const item of esItems) {
    console.log(`    tx: ${item.transaction_hash}, owner: ${item.current_owner}`);
  }
  await new Promise(r => setTimeout(r, 400));
}
