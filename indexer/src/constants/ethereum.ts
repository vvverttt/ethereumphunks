import { createPublicClient, fallback, http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

import dotenv from 'dotenv';
dotenv.config();

import pointsL1 from '@/abi/PointsL1.json';

import marketL1 from '@/abi/EtherPhunksMarketL1.json';

import lottery from '@/abi/PhilipLotteryV68.json';

export const pointsAbiL1 = pointsL1;

export const marketAbiL1 = marketL1;

export const lotteryAbi = lottery;

export const chain: 'mainnet' | 'sepolia' =
  process.env.CHAIN_ID === '1' ? 'mainnet' : 'sepolia';

export const l1RpcURL: string =
  chain === 'mainnet'
    ? process.env.RPC_URL_MAINNET
    : process.env.RPC_URL_SEPOLIA;

export const l1RpcURL_BACKUP: string =
  chain === 'mainnet'
    ? process.env.RPC_URL_MAINNET_BACKUP
    : process.env.RPC_URL_SEPOLIA_BACKUP;

export const marketAddressL1: string =
  (chain === 'mainnet'
    ? process.env.MARKET_ADDRESS_MAINNET_L1
    : process.env.MARKET_ADDRESS_SEPOLIA_L1)?.toLowerCase();

export const pointsAddressL1: string =
  (chain === 'mainnet'
    ? process.env.POINTS_ADDRESS_MAINNET
    : process.env.POINTS_ADDRESS_SEPOLIA)?.toLowerCase();

export const lotteryAddressL1: string =
  (chain === 'mainnet'
    ? process.env.LOTTERY_ADDRESS_MAINNET
    : process.env.LOTTERY_ADDRESS_SEPOLIA)?.toLowerCase();

const backupUrls = (l1RpcURL_BACKUP || '').split(',').filter(Boolean);

export const l1Client = createPublicClient({
  chain: chain === 'mainnet' ? mainnet : sepolia,
  transport: fallback([
    http(l1RpcURL),
    ...backupUrls.map(url => http(url.trim())),
  ], {
    rank: false,
  }),
  batch: {
    multicall: true,
  },
});
