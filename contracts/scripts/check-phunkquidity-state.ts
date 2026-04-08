import { ethers, upgrades } from 'hardhat';

async function main() {
  const PROXY = '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A';
  const V67_SLUG = '0x7251b5f8ffccbf983540edc0c91abb3eaa0c40131e33321b46d3cd9b9f0f1580';

  const impl = await upgrades.erc1967.getImplementationAddress(PROXY);
  console.log('Current implementation:', impl);

  const c = await ethers.getContractAt(
    ['function inputDisabled(bytes32) view returns (bool)'],
    PROXY
  );
  const v67Disabled = await c.inputDisabled(V67_SLUG);
  console.log('V67 inputDisabled:', v67Disabled);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
