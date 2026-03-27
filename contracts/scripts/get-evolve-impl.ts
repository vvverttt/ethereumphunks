import { upgrades } from 'hardhat';
const proxy = '0x0b4a5C756c4DF0A6FB399bF73ce5667A746dbFbA';
async function main() {
  const impl = await upgrades.erc1967.getImplementationAddress(proxy);
  console.log('Evolve impl:', impl);
}
main().catch(console.error);
