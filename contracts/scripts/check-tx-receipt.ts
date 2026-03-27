import hre from 'hardhat';

// Check tx for #10004 new hashId (0xa62831366cceaf8e...)
// We'll look at recent txs from the contract to find the withdrawal

async function main() {
  const PROXY = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';
  const provider = hre.ethers.provider;
  
  // Get block number
  const block = await provider.getBlockNumber();
  console.log('Current block:', block);

  // Check the tx we sent for #10004: need full hash
  // From script 65 output: tx=0xdf91af1849e68a26...
  // Let's check last few blocks for txs to the proxy
  
  // Actually let's look at a specific hashId's event in the events
  // Check if ethscriptions_protocol_TransferEthscriptionForPreviousOwner was emitted
  const TOPIC = hre.ethers.id('ethscriptions_protocol_TransferEthscriptionForPreviousOwner(address,address,bytes32)');
  console.log('Topic:', TOPIC);
  
  // Get logs from last 100 blocks
  const fromBlock = block - 100;
  const logs = await provider.getLogs({
    address: PROXY,
    topics: [TOPIC],
    fromBlock,
    toBlock: block,
  });
  
  console.log(`\nFound ${logs.length} TransferEthscriptionForPreviousOwner events in last 100 blocks`);
  for (const log of logs) {
    const prevOwner = '0x' + log.topics[1].slice(26);
    const recipient = '0x' + log.topics[2].slice(26);
    const hashId = log.topics[3];
    console.log(`  block=${log.blockNumber} prevOwner=${prevOwner} recipient=${recipient} hashId=${hashId.slice(0,18)}...`);
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
