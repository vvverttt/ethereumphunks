import { ethers } from 'hardhat';

const PROXY      = '0x9833b60234424e1DAAC8883D3F52c16093563BBF';
const VALIDATOR  = '0x721C0078c2328597Ca70F5451ffF5A7B38D4E947';

// The tx where we called setTransferSecurityLevelOfCollection
const SET_LEVEL_TX = '0xe272910ee157e9e88c4bc211b900d1d85d5e03b1696ec2e06d61e5b938cb76c2';
// The tx where we called applyListToCollection
const APPLY_LIST_TX = '0x401e817eb27adc58fad2695ca995e65c211e93b27f3ccba28776d78825900e88';

async function main() {
  const provider = ethers.provider;

  // Decode the setTransferSecurityLevel tx receipt
  const receipt = await provider.getTransactionReceipt(SET_LEVEL_TX);
  console.log('setTransferSecurityLevel tx status:', receipt?.status === 1 ? 'SUCCESS' : 'FAILED');
  console.log('logs:', receipt?.logs.length, 'events emitted');
  receipt?.logs.forEach((log, i) => {
    console.log(`  log[${i}] topics:`, log.topics);
    console.log(`  log[${i}] data:`, log.data);
  });

  console.log('\n--- applyListToCollection tx ---');
  const receipt2 = await provider.getTransactionReceipt(APPLY_LIST_TX);
  console.log('applyListToCollection tx status:', receipt2?.status === 1 ? 'SUCCESS' : 'FAILED');
  receipt2?.logs.forEach((log, i) => {
    console.log(`  log[${i}] topics:`, log.topics);
    console.log(`  log[${i}] data:`, log.data);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
