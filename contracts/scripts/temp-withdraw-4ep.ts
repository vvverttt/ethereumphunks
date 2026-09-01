import hre from 'hardhat';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8');

  const hashes = [
    '0x5b7c756e8aed63',  // need full hashes
    '0x520b7dc2930d85',
    '0xe92d8500be692d',
    '0xfb2b2c66b6fed3',
  ];

  // Get full hashes from Supabase
  const KEY = (process.env.SUPABASE_KEY || '');
  const contract_addr = '0x6a85c501b16e8c7be34eea409dab590a5b037cb8';

  const res = await fetch(`https://kcbuycbhynlmsrvoegzp.supabase.co/rest/v1/ethscriptions?select=hashId,tokenId&slug=eq.ethereum-phunks&owner=eq.${contract_addr}&limit=20`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const items = await res.json();

  console.log(`Found ${items.length} items to withdraw`);

  for (const item of items) {
    console.log(`Withdrawing #${item.tokenId} (${item.hashId.slice(0, 16)}...)...`);
    try {
      const tx = await contract.emergencyWithdrawEthscription(item.hashId);
      await tx.wait();
      console.log(`  TX: ${tx.hash}`);
    } catch (e: any) {
      console.log(`  Failed: ${e.reason || e.message?.slice(0, 80)}`);
    }
  }

  console.log('Done');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
