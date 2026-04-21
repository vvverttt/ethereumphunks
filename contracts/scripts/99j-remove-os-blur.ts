import { ethers } from 'hardhat';

const PROXY     = '0x9833b60234424e1DAAC8883D3F52c16093563BBF';
const VALIDATOR = '0x721C0078c2328597Ca70F5451ffF5A7B38D4E947';
const LIST_ID   = 27n;

const REMOVE = [
  '0x1E0049783F008A0085193E00003D00cd54003c71', // OpenSea
  '0x00000000000111AbE46ff893f3B2fdF1F759a8A8', // Blur
  '0x0000000000c2d145a2526bD8C716263bFeBe1A72', // Blur v2
];

const ABI = [
  'function removeAccountsFromWhitelist(uint120 id, address[] calldata accounts) external',
  'function getWhitelistedAccountsByCollection(address collection) external view returns (address[])',
  'function isAccountWhitelistedByCollection(address collection, address account) external view returns (bool)',
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log('Signer:', signer.address);

  const v = new ethers.Contract(VALIDATOR, ABI, signer);

  console.log('\nRemoving OpenSea + Blur from whitelist...');
  const tx = await v.removeAccountsFromWhitelist(
    LIST_ID,
    REMOVE.map(a => ethers.getAddress(a))
  );
  await tx.wait();
  console.log('✅ Removed:', tx.hash);

  console.log('\n── Final whitelist ────────────────────────────────────');
  const wl = await v.getWhitelistedAccountsByCollection(PROXY);
  wl.forEach((addr: string) => console.log(' ', addr));

  console.log('\n── Spot checks ────────────────────────────────────────');
  console.log('Our market:', await v.isAccountWhitelistedByCollection(PROXY, '0x19d57A31b982d3d75c16358795A4D19c803e4A72'));
  console.log('OpenSea:   ', await v.isAccountWhitelistedByCollection(PROXY, REMOVE[0]));
  console.log('Blur:      ', await v.isAccountWhitelistedByCollection(PROXY, REMOVE[1]));
}

main().catch(err => { console.error(err); process.exit(1); });
