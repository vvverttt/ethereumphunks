import hre from 'hardhat';

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Deploying new PhilipLotteryV68 implementation...');
  console.log('Signer:', signer.address);

  const Factory = await hre.ethers.getContractFactory('PhilipLotteryV67');
  const impl = await Factory.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();

  console.log('\n=====================================================================');
  console.log('New implementation deployed:', implAddress);
  console.log('=====================================================================');
  console.log('\nNext steps (from 0x19d57A31... wallet on Etherscan):');
  console.log('1. Go to Lottery 1 proxy admin: https://etherscan.io/address/0x426335fa9f974Ffb0c5Dc11313dc4cb4dd615E7d#writeContract');
  console.log('   Call upgrade(proxy, implementation):');
  console.log('     proxy: 0x29b0d38112e8e743b63EB463F3351ab0F1E15977');
  console.log('     implementation:', implAddress);
  console.log('');
  console.log('2. Go to Lottery 2 proxy admin: https://etherscan.io/address/0x29c9Cf618A057A2AF7885f03E0F211Bf07c4D885#writeContract');
  console.log('   Call upgrade(proxy, implementation):');
  console.log('     proxy: 0x298771ECc338DE242ADa11e49E2B8224c33bf620');
  console.log('     implementation:', implAddress);
  console.log('');
  console.log('Verify: npx hardhat verify --network mainnet', implAddress);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
