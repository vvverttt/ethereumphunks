import hre from 'hardhat';
import { ethers } from 'hardhat';
import { keccak256, toUtf8Bytes } from 'ethers';

export async function mineBlocks(n: number) {
  for (let i = 0; i < n; i++) {
    await hre.network.provider.send('evm_mine');
  }
}

export function createHashId(seed: string): string {
  return keccak256(toUtf8Bytes(seed));
}

export async function depositEthscription(
  signer: any,
  contractAddr: string,
  hashId: string,
) {
  return signer.sendTransaction({
    to: contractAddr,
    data: hashId,
  });
}

export async function depositMultipleEthscriptions(
  signer: any,
  contractAddr: string,
  hashIds: string[],
) {
  const data = '0x' + hashIds.map((h) => h.slice(2)).join('');
  return signer.sendTransaction({
    to: contractAddr,
    data,
  });
}

export async function depositAndMineBlocks(
  signer: any,
  contractAddr: string,
  hashId: string,
  blocks: number,
) {
  await depositEthscription(signer, contractAddr, hashId);
  await mineBlocks(blocks);
}
