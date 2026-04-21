import { createClient } from '@supabase/supabase-js';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const sb = createClient(
  'https://hzpwkpjxhtpcygrwtwku.supabase.co',
  'REDACTED_SUPABASE_SERVICE_ROLE'
);

const CONTRACT = '0x0b4a5c756c4df0a6fb399bf73ce5667a746dbfba';
const OWNER = '0xea04f65f9dc5917302532859d80fcf36a15de266';
const TOKEN_IDS = [10004,10015,10058,10078,10093,10099,10207,10250,10251,10259,10261,10277,10287,10290,10293,10295,10298,10299,10301,10306,10307,10308,10312];

// Get the new hashIds for these 23 tokens
const { data: tokens } = await sb
  .from('ethscriptions')
  .select('tokenId, hashId, owner')
  .in('tokenId', TOKEN_IDS)
  .eq('owner', OWNER);

console.log(`Found ${tokens.length} tokens owned by 0xea04 to index as deposited\n`);

// Check depositor state on-chain to confirm they are in contract
const client = createPublicClient({ chain: mainnet, transport: http('https://rpc.mevblocker.io') });
const ABI = [{name:'depositor',type:'function',inputs:[{type:'bytes32'}],outputs:[{type:'address'}],stateMutability:'view'}];
const PROXY = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';

let updated = 0;
for (const token of tokens) {
  const dep = await client.readContract({ address: PROXY, abi: ABI, functionName: 'depositor', args: [token.hashId] });
  const isDeposited = dep.toLowerCase() === OWNER;
  
  if (isDeposited) {
    // Update owner to contract in ethscriptions table
    const { error } = await sb.from('ethscriptions').update({ owner: CONTRACT }).eq('hashId', token.hashId);
    if (error) {
      console.log(`#${token.tokenId}: ❌ ${error.message}`);
    } else {
      console.log(`#${token.tokenId}: ✅ owner → contract (depositor confirmed on-chain)`);
      updated++;
    }
  } else {
    console.log(`#${token.tokenId}: depositor=${dep?.slice(0,10)} — NOT deposited yet`);
  }
}

console.log(`\nUpdated ${updated}/${tokens.length} tokens`);
