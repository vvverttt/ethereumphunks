import hre from 'hardhat';

async function check() {
  // Lottery
  const lottery = await hre.ethers.getContractAt('PhilipLotteryV68', '0x4c6569909028F11873Ba5548900d4609a436bB98');
  console.log('Lottery treasuryAddress:', await lottery.treasuryAddress());
  console.log('Lottery owner:', await lottery.owner());

  // Mutation
  const mutation = await hre.ethers.getContractAt('Mutation', '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA');
  console.log('Mutation owner:', await mutation.owner());

  // Marketplace
  const market = await hre.ethers.getContractAt('DystoLabzMarket', '0xa48a43186612B179C0bc68Ea34B4932549a70BfA');
  console.log('Market owner:', await market.owner());
  const count = await market.royaltySharesCount();
  console.log('Market royaltySharesCount:', count.toString());
  const shares = await market.royaltyShares();
  for (const s of shares) {
    console.log('  royalty receiver:', s.receiver, 'bps:', s.bps.toString());
  }
}

check().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
