import hre from 'hardhat';

// Addresses to grant POINTS_MANAGER_ROLE on deploy
const MANAGER_ADDRESSES = [
  (process.env as any).MARKET_ADDRESS   || '',  // Market contract
  (process.env as any).AUCTION_ADDRESS  || '',  // Auction contract
  (process.env as any).LOTTERY_ADDRESS  || '',  // Lottery contract
  (process.env as any).LOTTERY2_ADDRESS || '',  // Lottery 2 contract
].filter(Boolean);

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Deploying Points...');
  console.log('Signer (will be DEFAULT_ADMIN_ROLE):', signer.address);
  console.log('Manager addresses:', MANAGER_ADDRESSES);

  const Factory = await hre.ethers.getContractFactory('Points');
  const points = await Factory.deploy();
  await points.waitForDeployment();

  const addr = await points.getAddress();
  console.log('\nPoints deployed at:', addr);

  if (MANAGER_ADDRESSES.length) {
    const POINTS_MANAGER_ROLE = await (points as any).POINTS_MANAGER_ROLE();
    for (const manager of MANAGER_ADDRESSES) {
      console.log('Granting POINTS_MANAGER_ROLE to', manager);
      const tx = await (points as any).grantRole(POINTS_MANAGER_ROLE, manager);
      await tx.wait();
      console.log('  done');
    }
  }

  console.log('\nDone. Update environment.mainnet.ts:');
  console.log(`  pointsAddress: '${addr}'.toLowerCase(),`);
  console.log('\nThen update each contract that calls addPoints:');
  console.log('  market.setPointsAddress(' + addr + ')');
  console.log('  auction.setPointsAddress(' + addr + ')');
  console.log('  lottery.setPointsAddress(' + addr + ')');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
