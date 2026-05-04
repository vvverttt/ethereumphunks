import { createPublicClient, fallback, http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

import dotenv from 'dotenv';
dotenv.config();

import pointsL1 from '@/abi/PointsL1.json';

import marketL1 from '@/abi/EtherPhunksMarketL1.json';

import lottery from '@/abi/PhilipLotteryV68.json';

import mutation from '@/abi/Mutation.json';

import auctionV2 from '@/abi/EtherPhunksAuctionHouseV2.json';

export const pointsAbiL1 = pointsL1;

export const marketAbiL1 = marketL1;

export const lotteryAbi = lottery;

export const mutationAbi = mutation;

export const auctionAbiV2 = auctionV2;

export const chain: 'mainnet' | 'sepolia' =
  process.env.CHAIN_ID === '1' ? 'mainnet' : 'sepolia';

export const l1RpcURL: string =
  chain === 'mainnet'
    ? process.env.RPC_URL_MAINNET
    : process.env.RPC_URL_SEPOLIA;

export const l1RpcURL_2: string =
  chain === 'mainnet'
    ? process.env.RPC_URL_MAINNET_2
    : undefined;

export const l1RpcURL_BACKUP: string =
  chain === 'mainnet'
    ? process.env.RPC_URL_MAINNET_BACKUP
    : process.env.RPC_URL_SEPOLIA_BACKUP;

export const marketAddressL1: string =
  (chain === 'mainnet'
    ? process.env.MARKET_ADDRESS_MAINNET_L1
    : process.env.MARKET_ADDRESS_SEPOLIA_L1)?.toLowerCase();

export const oldMarketAddressL1: string =
  (chain === 'mainnet'
    ? process.env.OLD_MARKET_ADDRESS_MAINNET_L1
    : '')?.toLowerCase();

export const evolveAddressL1: string =
  (chain === 'mainnet'
    ? process.env.EVOLVE_ADDRESS_MAINNET
    : process.env.EVOLVE_ADDRESS_SEPOLIA)?.toLowerCase();

export const marketAddressesL1 = new Set(
  [marketAddressL1, oldMarketAddressL1, evolveAddressL1].filter(Boolean)
);

export const pointsAddressL1: string =
  (chain === 'mainnet'
    ? process.env.POINTS_ADDRESS_MAINNET
    : process.env.POINTS_ADDRESS_SEPOLIA)?.toLowerCase();

export const lotteryAddressL1: string =
  (chain === 'mainnet'
    ? process.env.LOTTERY_ADDRESS_MAINNET
    : process.env.LOTTERY_ADDRESS_SEPOLIA)?.toLowerCase();

export const lottery2AddressL1: string =
  (chain === 'mainnet'
    ? process.env.LOTTERY2_ADDRESS_MAINNET
    : process.env.LOTTERY2_ADDRESS_SEPOLIA)?.toLowerCase() || '';

export const lotteryAddressesL1 = new Set(
  [lotteryAddressL1, lottery2AddressL1].filter(Boolean)
);

export const auctionAddressL1: string =
  (chain === 'mainnet'
    ? process.env.AUCTION_ADDRESS_MAINNET
    : process.env.AUCTION_ADDRESS_SEPOLIA)?.toLowerCase();

export const auction2AddressL1: string =
  (chain === 'mainnet'
    ? process.env.AUCTION2_ADDRESS_MAINNET
    : '')?.toLowerCase() || '';

export const auctionAddressesL1 = new Set(
  [auctionAddressL1, auction2AddressL1].filter(Boolean)
);

const backupUrls = (l1RpcURL_BACKUP || '').split(',').filter(Boolean);
// Order: Ankr primary → Ankr key 2 → Alchemy (first in backup list) → others
const [alchemyUrl, ...restBackupUrls] = backupUrls;

export const l1Client = createPublicClient({
  chain: chain === 'mainnet' ? mainnet : sepolia,
  transport: fallback([
    http(l1RpcURL, { timeout: 30_000 }),
    ...(l1RpcURL_2 ? [http(l1RpcURL_2, { timeout: 30_000 })] : []),
    ...(alchemyUrl ? [http(alchemyUrl.trim(), { timeout: 30_000 })] : []),
    ...restBackupUrls.map(url => http(url.trim(), { timeout: 30_000 })),
  ], {
    rank: false,
    retryCount: 2,
  }),
  batch: {
    multicall: true,
  },
});
