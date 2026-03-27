import hre from 'hardhat';
import { createClient } from '@supabase/supabase-js';

const LOTTERY1 = '0x29b0d38112e8e743b63eb463f3351ab0f1e15977';
const HASHID = '0x11c4ff0c96fa5d01b76acf7e6bd193c2d493fe6310ebdcf84670d60d9747ab0d';
const RECIPIENT = '0xea04f65f9dc5917302532859d80fcf36a15de266';
const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE'] || '';
const PAGE = 100n;

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const [signer] = await hre.ethers.getSigners();
  const contract = await hre.ethers.getContractAt('PhilipLotteryV67', LOTTERY1, signer);

  // Check if in pool
  const poolSize: bigint = await contract.poolSize();
  const items: string[] = [];
  for (let i = 0n; i < poolSize; i += PAGE) {
    const chunk: string[] = await contract.getPoolItems(i, i + PAGE > poolSize ? poolSize - i : PAGE);
    items.push(...chunk);
  }

  const inPool = items.some(h => h.toLowerCase() === HASHID.toLowerCase());
  console.log(`#1848 hashId in Lottery1 pool: ${inPool}`);

  if (inPool) {
    const gas = await contract.withdrawPrizeBatch.estimateGas([HASHID]);
    const feeData = await hre.ethers.provider.getFeeData();
    console.log(`Est gas: ${gas.toLocaleString()} = ${hre.ethers.formatEther(gas * feeData.gasPrice!)} ETH`);

    const tx = await contract.withdrawPrizeBatch([HASHID]);
    console.log('Tx:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Withdrawn, block', receipt?.blockNumber);
  }

  // Update DB owner to dystolabz
  const { data, error } = await supabase.from('ethscriptions')
    .update({ owner: RECIPIENT })
    .eq('hashId', HASHID)
    .select('tokenId, owner');
  if (error) console.error('DB error:', error.message);
  else console.log('✅ DB owner updated:', JSON.stringify(data));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
