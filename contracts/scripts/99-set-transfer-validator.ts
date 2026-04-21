import { ethers } from 'hardhat';

const PROXY     = '0x9833b60234424e1DAAC8883D3F52c16093563BBF';
const VALIDATOR = '0x721C0078c2328597Ca70F5451ffF5A7B38D4E947';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Caller:', deployer.address);

  const contract = await ethers.getContractAt('ERC721PhunksV67', PROXY);
  const tx = await contract.setTransferValidator(VALIDATOR);
  console.log('tx hash:', tx.hash);
  await tx.wait();
  console.log('✅  TransferValidator set:', VALIDATOR);
}

main().catch(err => { console.error(err); process.exit(1); });
