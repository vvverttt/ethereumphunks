import { ethers } from 'hardhat';

const PROXY = '0x9833b60234424e1DAAC8883D3F52c16093563BBF';

async function main() {
  const [deployer] = await ethers.getSigners();
  const contract = await ethers.getContractAt('ERC721PhunksV67', PROXY);

  const current = await contract.operatorWhitelistEnabled();
  console.log('operatorWhitelistEnabled currently:', current);

  if (!current) { console.log('Already disabled.'); return; }

  const tx = await contract.setOperatorWhitelistEnabled(false);
  console.log('tx hash:', tx.hash);
  await tx.wait();
  console.log('✅  Manual whitelist disabled — ERC721-C validator is now sole gatekeeper');
}

main().catch(err => { console.error(err); process.exit(1); });
