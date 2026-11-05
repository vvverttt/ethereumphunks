import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http((process.env.RPC_URL_MAINNET || 'https://ethereum-rpc.publicnode.com'))
});

async function testOne() {
  const hash = '0x96bf5702ebada826a3f2c10ab91781d06c16cc01cd9f007522f16c91c5e822e6';

  console.log('Testing transaction fetch...');
  console.log('Hash:', hash);

  try {
    const tx = await client.getTransaction({ hash });
    console.log('\n✅ Transaction found!');
    console.log('From:', tx.from);
    console.log('Block:', tx.blockNumber);

    const block = await client.getBlock({ blockNumber: tx.blockNumber });
    console.log('Timestamp:', new Date(Number(block.timestamp) * 1000).toISOString());
  } catch (err) {
    console.log('\n❌ Error:', err.message);
  }
}

testOne();
