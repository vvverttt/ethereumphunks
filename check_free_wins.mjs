import { createPublicClient, http, formatEther } from 'viem';
import { mainnet } from 'viem/chains';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kfnprbhoodmgfhqojmqp.supabase.co';
const supabaseKey = (process.env.SUPABASE_KEY || 'sb_publishable_c-JzxJH0a6_ex9vDW3ItFg_-G3jkuHe');
const supabase = createClient(supabaseUrl, supabaseKey);

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com'),
});

async function main() {
  // Get all lottery wins
  const { data: wins, error } = await supabase
    .from('lottery_wins')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('DB error:', error.message); return; }

  console.log(`Found ${wins.length} lottery wins\n`);

  for (const win of wins) {
    console.log(`Play #${win.play_id} | Contract: ${win.contract_address.slice(0,10)}... | Winner: ${win.winner.slice(0,10)}... | Token: #${win.token_id} | TX: ${win.tx_hash?.slice(0,18)}...`);

    if (win.tx_hash) {
      try {
        const tx = await client.getTransaction({ hash: win.tx_hash });
        const receipt = await client.getTransactionReceipt({ hash: win.tx_hash });

        console.log(`  From: ${tx.from.toLowerCase()}`);
        console.log(`  To: ${tx.to?.toLowerCase()}`);
        console.log(`  Value sent: ${formatEther(tx.value)} ETH`);
        console.log(`  Status: ${receipt.status}`);
        console.log(`  Block: ${receipt.blockNumber}`);

        // Check if the tx was a revealPlay (the reveal tx is what triggers PrizeAwarded)
        // The commit tx is separate and carries the payment
        // Let's also find the commit tx for this player
        console.log(`  Function: ${tx.input?.slice(0, 10)}`);
      } catch (err) {
        console.log(`  ERROR fetching tx: ${err.message?.slice(0, 60)}`);
      }
    }
    console.log('');
  }
}

main().catch(console.error);
