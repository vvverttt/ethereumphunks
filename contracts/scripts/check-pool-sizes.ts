import hre from 'hardhat';

const standard = '0x29b0d38112e8e743b63EB463F3351ab0F1E15977';
const premium  = '0x298771ECc338DE242ADa11e49E2B8224c33bf620';
const abi = ['function poolSize() view returns (uint256)'];

async function main() {
  const s = await hre.ethers.getContractAt(abi, standard);
  const p = await hre.ethers.getContractAt(abi, premium);
  console.log('Standard pool:', (await s.poolSize()).toString());
  console.log('Premium pool: ', (await p.poolSize()).toString());
}

main().catch(console.error);
