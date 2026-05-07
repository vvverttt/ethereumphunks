import hre from 'hardhat';

async function main() {
  const contract = await hre.ethers.getContractAt('EthsRocksV2', '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8');
  const provider = hre.ethers.provider;
  const block = await provider.getBlockNumber();
  const SAFE_WALLET = '0x19d57A31b982d3d75c16358795A4D19c803e4A72';

  // Look at recent transactions to the contract
  // Check the last 50 blocks for any transactions
  console.log('Checking recent txs to contract...\n');

  // Try known addresses - your wallet
  const addresses = [
    SAFE_WALLET,
    '0xf1Aa941d56041d47a9a18e99609A047707Fe96c7',
  ];

  // Check ethscription storage for each address against OG items
  // Fetch OG hashIds from Supabase
  const SUPABASE_URL = 'https://hzpwkpjxhtpcygrwtwku.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cHdrcGp4aHRwY3lncnd0d2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMTQwNDMsImV4cCI6MjA4NTg5MDA0M30.BxG4LrAQOckVGBtAMtPUP4qnEpN-ZvTdRy53LEzbWyY';

  // Get items owned by contract (deposited for swap)
  const url = new URL(`${SUPABASE_URL}/rest/v1/ethscriptions`);
  url.searchParams.set('select', 'hashId,tokenId,slug,owner,prevOwner');
  url.searchParams.set('owner', 'eq.0x6a85c501b16e8c7be34eea409dab590a5b037cb8');
  url.searchParams.set('slug', 'in.(og-missing-phunks,og-dysto-phunks)');
  url.searchParams.set('limit', '100');

  const res = await fetch(url.toString(), {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const items = await res.json();

  console.log(`OG items owned by contract: ${items.length}`);
  for (const item of items) {
    console.log(`  ${item.slug} #${item.tokenId} hashId: ${item.hashId.slice(0,20)}... prevOwner: ${item.prevOwner}`);

    // Check on-chain deposit status
    for (const addr of addresses) {
      try {
        const stored = await contract.getFunction('userEthscriptionPossiblyStored')(addr, item.hashId);
        if (stored) {
          console.log(`    -> DEPOSITED by ${addr}`);
        }
      } catch {}
    }

    // Check eligibility
    const eligible = await contract.eligibleEthscription(item.hashId);
    console.log(`    -> Eligible: ${eligible}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
