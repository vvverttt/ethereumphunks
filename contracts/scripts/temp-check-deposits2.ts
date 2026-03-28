import hre from 'hardhat';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8');
  const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYnV5Y2JoeW5sbXNydm9lZ3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODkyMTMzNTQsImV4cCI6MjAwNDc4OTM1NH0.jUvNzW6jrBPfKg9SvDhW5auqF8y_DKo4tmAmXCwgHAY';
  const res = await fetch(`https://kcbuycbhynlmsrvoegzp.supabase.co/rest/v1/ethscriptions?select=hashId,tokenId&slug=eq.ethereum-phunks&owner=eq.0x6a85c501b16e8c7be34eea409dab590a5b037cb8&limit=20`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const items = await res.json();
  console.log('EtherPhunks in contract:', items.length);

  for (const i of items) {
    const dep = await contract.userEthscriptionPossiblyStored('0x436196aB0550E73AEEdd1a494C2420DAcA7Fe0Ca', i.hashId);
    console.log(`  #${i.tokenId} ${i.hashId.slice(0,14)}... deposited by 0x4361: ${dep}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
