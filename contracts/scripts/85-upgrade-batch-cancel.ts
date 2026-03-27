import hre, { upgrades } from 'hardhat';

const proxyAddress = '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8';
const DEPOSITOR = '0x78d3AAf8E3cd4B350635C79b7021Bd76144c582C';

const EPKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYnV5Y2JoeW5sbXNydm9lZ3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODkyMTMzNTQsImV4cCI6MjAwNDc4OTM1NH0.jUvNzW6jrBPfKg9SvDhW5auqF8y_DKo4tmAmXCwgHAY';

async function main() {
  const [signer] = await hre.ethers.getSigners();

  // Upgrade
  console.log('Upgrading...');
  const ContractFactory = await hre.ethers.getContractFactory('EthsRocksV2');
  await upgrades.upgradeProxy(proxyAddress, ContractFactory, { unsafeSkipStorageCheck: true });
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log('New implementation:', implAddress);

  const contract = await hre.ethers.getContractAt('EthsRocksV2', proxyAddress);

  // Find deposited hashIds for 0x78d3
  const res = await fetch(
    `https://kcbuycbhynlmsrvoegzp.supabase.co/rest/v1/ethscriptions?select=hashId,tokenId&slug=eq.ethereum-phunks&owner=eq.${proxyAddress.toLowerCase()}&limit=20`,
    { headers: { apikey: EPKEY, Authorization: `Bearer ${EPKEY}` } }
  );
  const items = await res.json();

  // Filter to ones deposited by 0x78d3
  const toReturn: string[] = [];
  for (const item of items) {
    const stored = await contract.userEthscriptionPossiblyStored(DEPOSITOR, item.hashId);
    if (stored) {
      toReturn.push(item.hashId);
      console.log(`  #${item.tokenId} deposited by ${DEPOSITOR}`);
    }
  }

  if (toReturn.length > 0) {
    console.log(`\nReturning ${toReturn.length} to ${DEPOSITOR}...`);
    const tx = await contract.returnDepositBatch(DEPOSITOR, toReturn);
    await tx.wait();
    console.log('TX:', tx.hash);
    console.log('Done — returned to depositor');
  } else {
    console.log('No deposits found for', DEPOSITOR);
  }

  console.log(`\nVerify: npx hardhat verify --network mainnet ${implAddress}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
