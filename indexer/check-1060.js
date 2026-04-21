const { createClient } = require('@supabase/supabase-js');
const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');

const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const ADDR = '0xf1aa941d56041d47a9a18e99609a047707fe96c7';
const HASHID = '0x24f5fc1c02ae3597e0e6109b18cfdca887515742f75c4de8d91920348528c22e';

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const client = createPublicClient({ chain: mainnet, transport: http('https://eth.llamarpc.com') });

  const code = await client.getBytecode({ address: ADDR });
  const isContract = code && code !== '0x';
  console.log('0xf1aa941d is contract:', isContract ? 'YES' : 'NO (EOA)');

  // Check transfers table
  const { data: transfers } = await supabase.from('transfers').select('*').eq('hashId', HASHID).order('blockNumber', { ascending: false }).limit(10);
  console.log('\nRecent transfers for #1060 hashId:');
  console.log(JSON.stringify(transfers, null, 2));

  // Check attributes
  const { data: attrs } = await supabase.from('attributes_new').select('tokenId, values').eq('slug', 'cryptophunksv67').eq('tokenId', 1060);
  console.log('\nattributes_new for #1060:');
  console.log(JSON.stringify(attrs, null, 2));

  // Check if there are any other tokens owned by 0xf1aa941d
  const { count } = await supabase.from('ethscriptions').select('*', { count: 'exact', head: true }).eq('owner', ADDR).eq('slug', 'cryptophunksv67');
  console.log('\nTotal cryptophunksv67 tokens owned by 0xf1aa941d:', count);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
