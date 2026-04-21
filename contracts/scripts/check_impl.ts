import { ethers } from 'hardhat';
async function main() {
  const PROXY_ADMIN = '0x449b1B1bf25F4e76AEDef971A790bd84aa351235';
  const PROXY = '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A';
  const pa = await ethers.getContractAt(
    ['function getProxyImplementation(address proxy) view returns (address)'],
    PROXY_ADMIN
  );
  const impl = await pa.getProxyImplementation(PROXY);
  console.log('Current impl:', impl);
  console.log('Expected:    ', '0xB1f410bbd1fD027cBa54540011a619f830a6cC1a');
}
main().catch(console.error);
