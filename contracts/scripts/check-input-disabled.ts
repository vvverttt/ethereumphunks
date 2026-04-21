import { ethers } from 'hardhat';
async function main() {
  const c = await ethers.getContractAt(
    ['function inputDisabled(bytes32) view returns (bool)'],
    '0x7f5763D56c7E8c34eB125DbD19124945D77e5f1A'
  );
  const slugs = {
    'v3-phunks': '0x2eaec94c1cb6885aac629a5080912f782829ff89d7c36a597d613c5a8ab077f7',
    'pepephunks': '0x326ad8cf9d7859b60f15a198566ae475eac49efbeae719ef1bed0e6bf046e050',
    'skelephunks': '0x112b859a15128e1989fe8b75881262125890a0b699a4cb0a1511d759a58e3e76',
    'etherphunks': '0x63394c45a9586e579edf330bda67d6bd9a4f00cf58644d9bf8a2a7c147119629',
    'cryptophunksv67': '0x7251b5f8ffccbf983540edc0c91abb3eaa0c40131e33321b46d3cd9b9f0f1580',
  };
  for (const [name, slug] of Object.entries(slugs)) {
    console.log(name, await c.inputDisabled(slug));
  }
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
