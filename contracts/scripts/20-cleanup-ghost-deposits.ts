import hre from 'hardhat';

const PROXY_ADDRESS = '0xa48a43186612B179C0bc68Ea34B4932549a70BfA';

// Ghost entries stored from the failed deposit-and-list (wrong keccak256 sig)
const GHOST_ENTRIES = [
  {
    label: 'keccak256 sig ghost',
    id: '0x96e5a21bf554b18c7c75bab6733f0341480004878d6b0e8b6996e86bad64d65a',
  },
  {
    label: 'price ghost (0.001 ETH)',
    id: '0x00000000000000000000000000000000000000000000000000038d7ea4c68000',
  },
  {
    label: 'zero bytes32 ghost',
    id: '0x0000000000000000000000000000000000000000000000000000000000000000',
  },
];

async function main() {
  const [signer] = await hre.ethers.getSigners();
  console.log('Cleaning up ghost deposits with account:', signer.address);

  const abi = [
    'function withdrawPhunk(bytes32 ethscriptionId) external',
    'function userEthscriptionPossiblyStored(address owner, bytes32 ethscriptionId) external view returns (bool)',
  ];

  const contract = new hre.ethers.Contract(PROXY_ADDRESS, abi, signer);

  for (const ghost of GHOST_ENTRIES) {
    const stored = await contract.userEthscriptionPossiblyStored(signer.address, ghost.id);
    if (!stored) {
      console.log(`  ${ghost.label}: already clean, skipping`);
      continue;
    }

    console.log(`  ${ghost.label}: withdrawing...`);
    const tx = await contract.withdrawPhunk(ghost.id);
    console.log(`    tx: ${tx.hash}`);
    await tx.wait();
    console.log(`    confirmed`);
  }

  console.log('Done!');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
