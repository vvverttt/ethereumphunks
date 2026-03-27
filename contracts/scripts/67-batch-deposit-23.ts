import hre from 'hardhat';
import { createClient } from '@supabase/supabase-js';

const PROXY_ADDRESS = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';
const sb = (createClient as any)(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMxNDA0MywiZXhwIjoyMDg1ODkwMDQzfQ.n4_1A7B6MRHTaeXX7CZkzEsveAJ1KzHziHhxH5qsYAs'
);

const TOKEN_IDS = [10004,10015,10058,10078,10093,10099,10207,10250,10251,10259,10261,10277,10287,10290,10293,10295,10298,10299,10301,10306,10307,10308,10312];
const OWNER = '0xea04f65f9dc5917302532859d80fcf36a15de266';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Signer:', signer.address);

  // Get new hashIds from DB
  const { data: tokens } = await sb
    .from('ethscriptions')
    .select('tokenId, hashId')
    .in('tokenId', TOKEN_IDS)
    .eq('owner', OWNER);

  if (!tokens || tokens.length !== 23) {
    throw new Error(`Expected 23 tokens, got ${tokens?.length}`);
  }

  // Sort by tokenId
  tokens.sort((a: any, b: any) => a.tokenId - b.tokenId);
  console.log(`\nBatch depositing ${tokens.length} quantum phunks:`);
  for (const t of tokens) {
    console.log(`  #${t.tokenId}: ${t.hashId}`);
  }

  // Concatenate all hashIds as calldata (32 bytes each, strip 0x prefix)
  const calldata = '0x' + tokens.map((t: any) => t.hashId.slice(2)).join('');
  console.log(`\nCalldata length: ${(calldata.length - 2) / 2} bytes (${tokens.length} × 32)`);

  // Send transaction to contract with concatenated hashIds as data
  const tx = await signer.sendTransaction({
    to: PROXY_ADDRESS,
    data: calldata,
    value: 0n,
  });

  console.log(`\nTx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Status: ${receipt?.status} Block: ${receipt?.blockNumber}`);

  if (receipt?.status === 1) {
    console.log('\n✅ Batch deposit successful!');
  } else {
    console.log('\n❌ Transaction failed');
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
