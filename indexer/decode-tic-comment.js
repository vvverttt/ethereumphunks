const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

const RPC_URL = 'https://ethereum-rpc.publicnode.com';
const TX_HASH = '0x05032d5d081920f9786bd8b5723b3480c0258a3346afa67f04ca8f29baf633f6';
const TIC_PREFIX = 'data:message/vnd.tic+json;rule=esip6,';

async function rpcCall(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC error: ${JSON.stringify(json.error)}`);
  return json.result;
}

async function main() {
  // Step 1: Fetch the transaction
  console.log('=== Step 1: Fetching transaction ===');
  console.log('TX Hash:', TX_HASH);
  const tx = await rpcCall('eth_getTransactionByHash', [TX_HASH]);
  console.log('From:', tx.from);
  console.log('To:', tx.to);
  console.log('Block Number (hex):', tx.blockNumber);
  console.log('Input data length:', tx.input.length, 'chars');

  // Step 2-3: Decode the input data (hex to UTF-8)
  console.log('\n=== Step 2-3: Decoding input data (hex -> UTF-8) ===');
  const hexData = tx.input.startsWith('0x') ? tx.input.slice(2) : tx.input;
  const decoded = Buffer.from(hexData, 'hex').toString('utf8');
  console.log('Decoded text:', decoded);

  // Step 4-5: Check TIC prefix
  console.log('\n=== Step 4-5: Checking TIC prefix ===');
  const startsWith = decoded.startsWith(TIC_PREFIX);
  console.log('Starts with TIC prefix?', startsWith);

  if (!startsWith) {
    console.log('Not a TIC message. Exiting.');
    return;
  }

  // Step 6: Parse the JSON after the prefix
  console.log('\n=== Step 6: Parsing TIC JSON ===');
  const jsonStr = decoded.slice(TIC_PREFIX.length);
  console.log('JSON string:', jsonStr);
  const ticData = JSON.parse(jsonStr);
  console.log('Parsed TIC data:', JSON.stringify(ticData, null, 2));

  // Step 7-8: Get transaction receipt and block for timestamp
  console.log('\n=== Step 7-8: Fetching receipt and block ===');
  const receipt = await rpcCall('eth_getTransactionReceipt', [TX_HASH]);
  const blockNumber = receipt.blockNumber;
  console.log('Block number from receipt:', blockNumber, '(decimal:', parseInt(blockNumber, 16), ')');

  const block = await rpcCall('eth_getBlockByNumber', [blockNumber, false]);
  const timestampHex = block.timestamp;
  const timestampUnix = parseInt(timestampHex, 16);
  const timestampISO = new Date(timestampUnix * 1000).toISOString();
  console.log('Block timestamp (hex):', timestampHex);
  console.log('Block timestamp (unix):', timestampUnix);
  console.log('Block timestamp (ISO):', timestampISO);

  // Step 9: Determine topicType and insert into Supabase
  console.log('\n=== Step 9: Inserting into Supabase ===');
  const topic = ticData.topic || ticData.t;
  const content = ticData.content || ticData.c;
  const version = ticData.version || ticData.v;

  let topicType;
  if (topic && topic.length === 42) {
    topicType = 'address';
  } else if (topic && topic.length === 66) {
    topicType = 'hash';
  } else {
    topicType = 'unknown';
    console.log('WARNING: topic length is', topic ? topic.length : 'N/A', '- neither 42 nor 66');
  }

  const row = {
    id: TX_HASH,
    topic,
    topicType,
    content,
    version,
    createdAt: timestampISO,
    from: tx.from.toLowerCase(),
    deleted: false,
    encoding: ticData.encoding || 'utf8',
    type: ticData.type || 'comment',
  };

  console.log('Row to insert:', JSON.stringify(row, null, 2));

  const { data, error } = await supabase.from('comments').upsert(row, { onConflict: 'id' }).select();
  if (error) {
    console.error('Supabase insert error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Inserted successfully:', JSON.stringify(data, null, 2));
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
