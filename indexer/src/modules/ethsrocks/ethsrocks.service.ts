import { Injectable } from '@nestjs/common';
import { type Hex } from 'viem';

import { l1Client } from '@/constants/ethereum';

// EthsRocks V2 contract — open sale, no gating
const ETHSROCKS_ADDRESS = (process.env.ETHSROCKS_ADDRESS_MAINNET || '0x6A85c501B16E8c7bE34Eea409dAb590A5B037CB8').toLowerCase() as Hex;

const POOL_SIZE_ABI = [{
  inputs: [],
  name: 'poolSize',
  outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}] as const;

const CURRENT_PRICE_ABI = [{
  inputs: [],
  name: 'currentPrice',
  outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}] as const;

const TOTAL_REVEALED_ABI = [{
  inputs: [],
  name: 'totalRevealed',
  outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}] as const;

const PAUSED_ABI = [{
  inputs: [],
  name: 'paused',
  outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
  stateMutability: 'view',
  type: 'function',
}] as const;

@Injectable()
export class EthsRocksService {

  async getContractState(): Promise<{
    poolSize: number;
    currentPrice: string;
    totalRevealed: number;
    paused: boolean;
  }> {
    const [poolSize, currentPrice, totalRevealed, paused] = await Promise.all([
      l1Client.readContract({ address: ETHSROCKS_ADDRESS, abi: POOL_SIZE_ABI, functionName: 'poolSize' }),
      l1Client.readContract({ address: ETHSROCKS_ADDRESS, abi: CURRENT_PRICE_ABI, functionName: 'currentPrice' }),
      l1Client.readContract({ address: ETHSROCKS_ADDRESS, abi: TOTAL_REVEALED_ABI, functionName: 'totalRevealed' }),
      l1Client.readContract({ address: ETHSROCKS_ADDRESS, abi: PAUSED_ABI, functionName: 'paused' }),
    ]);

    return {
      poolSize: Number(poolSize),
      currentPrice: currentPrice.toString(),
      totalRevealed: Number(totalRevealed),
      paused,
    };
  }
}
