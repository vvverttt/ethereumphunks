import hre from 'hardhat';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8');

  // The actual 5 deposited by 0x4361
  const hashes = [
    '0x309c24278537c4337d93f96e287ba1bca820ecbb53799d32236847a261d1ed3b',
    '0x0a9c1c695d9e20bfeab770dc4b50b5d2fcc59aa489f6fc8b450e8ef2b5c8386b',
    '0x3a17681a2075a204a9ee8fb47edbddac5bbcd73ddce4efc3cd84dbbe837fc8f4',
    '0x585e362ad91d', // need full hash
    '0x6fc2dc9f8166a368a4f9e2f2696810f2acecbfb3607c4140c7b0158275f1943c',
  ];

  // Get full hash from Supabase
  const KEY = (process.env.SUPABASE_KEY || '');
  const res = await fetch(`https://kcbuycbhynlmsrvoegzp.supabase.co/rest/v1/ethscriptions?select=hashId,tokenId&slug=eq.ethereum-phunks&owner=eq.0x6a85c501b16e8c7be34eea409dab590a5b037cb8&limit=20`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const items = await res.json();

  console.log('All deposited:');
  const allHashes: string[] = [];
  for (const i of items) {
    const used = await contract.usedBatchEthscription(i.hashId);
    const dep = await contract.userEthscriptionPossiblyStored('0x436196aB0550E73AEEdd1a494C2420DAcA7Fe0Ca', i.hashId);
    console.log(`  #${i.tokenId} ${i.hashId.slice(0,14)}... used: ${used} dep: ${dep}`);
    allHashes.push(i.hashId);
  }

  // Reset ALL used flags for deposited items
  const toReset = [];
  for (const h of allHashes) {
    const used = await contract.usedBatchEthscription(h);
    if (used) toReset.push(h);
  }

  if (toReset.length > 0) {
    console.log(`\nResetting ${toReset.length} used flags...`);
    const tx = await contract.resetUsedBatchEthscriptions(toReset);
    await tx.wait();
    console.log('TX:', tx.hash);
  } else {
    console.log('\nNo used flags to reset');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
