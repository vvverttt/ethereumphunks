import hre, { upgrades } from 'hardhat';

const standard = '0x29b0d38112e8e743b63EB463F3351ab0F1E15977';
const premium = '0x298771ECc338DE242ADa11e49E2B8224c33bf620';

async function main() {
  const [implS, implP] = await Promise.all([
    upgrades.erc1967.getImplementationAddress(standard),
    upgrades.erc1967.getImplementationAddress(premium),
  ]);
  console.log('Standard impl:', implS);
  console.log('Premium impl: ', implP);
  console.log('Same?', implS === implP);

  // Compare what hardhat thinks the compiled bytecode is
  const v67Artifact = await hre.artifacts.readArtifact('PhilipLotteryV67');
  const v68Artifact = await hre.artifacts.readArtifact('PhilipLotteryV68_V2');
  const v67Code = v67Artifact.deployedBytecode;
  const v68Code = v68Artifact.deployedBytecode;
  console.log('\nV67 bytecode length: ', v67Code.length);
  console.log('V68_V2 bytecode length:', v68Code.length);
  console.log('Bytecodes identical?', v67Code === v68Code);

  // Query both proxies for basic state
  const iface = new hre.ethers.Interface([
    'function playPrice() view returns (uint256)',
    'function active() view returns (bool)',
    'function pendingReveals() view returns (uint256)',
  ]);
  const provider = hre.ethers.provider;
  const calls = ['playPrice', 'active', 'pendingReveals'];
  for (const fn of calls) {
    const data = iface.encodeFunctionData(fn);
    const [rs, rp] = await Promise.all([
      provider.call({ to: standard, data }),
      provider.call({ to: premium, data }),
    ]);
    const decoded = iface.decodeFunctionResult(fn, rs)[0];
    const decodedP = iface.decodeFunctionResult(fn, rp)[0];
    console.log(`${fn}: standard=${decoded}, premium=${decodedP}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
