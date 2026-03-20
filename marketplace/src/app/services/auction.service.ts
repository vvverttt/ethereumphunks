import { Injectable } from '@angular/core';
import { formatEther, parseEther, decodeEventLog, createPublicClient, http, fallback } from 'viem';
import { mainnet } from 'viem/chains';
import { getWalletClient, getChainId, getPublicClient, reconnect } from '@wagmi/core';

import { environment } from 'src/environments/environment';
import { supabase } from './supabase';
import { Web3Service } from './web3.service';
import { EtherPhunksAuctionHouseV2ABI } from '@/abi/EtherPhunksAuctionHouseV2';
const suffix = environment.chainId === 1 ? '' : '_sepolia';
const auctionAddress = (environment as any).auctionAddress as `0x${string}`;
const auctionDeployBlock = ((environment as any).auctionDeployBlock as bigint) || 0n;
const MAX_BLOCK_RANGE = 10000n;

// Dedicated client for eth_getLogs (Alchemy free tier limits to 10 blocks)
const logsClient = createPublicClient({
  chain: mainnet,
  transport: fallback([
    http('https://rpc.ankr.com/eth/545e600765426a4f17b1d59db878210f81e6fecbe581c0a745a7068c62fc1eb8'),
    http('https://rpc.mevblocker.io'),
    http('https://1rpc.io/eth'),
  ], { rank: false }),
});

export interface AuctionData {
  hashId: string;
  amount: bigint;
  startTime: number;
  endTime: number;
  bidder: string;
  settled: boolean;
  auctionId: number;
}

export interface AuctionBidEvent {
  sender: string;
  value: bigint;
  txHash: string;
}

export interface SettledAuction {
  auctionId: number;
  hashId: string;
  winner: string;
  amount: bigint;
  imageUrl: string;
  tokenId: number;
  slug: string;
  settledTimestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuctionService {

  constructor(
    private web3Svc: Web3Service,
  ) {}

  // =========================================================
  // Contract Reads
  // =========================================================

  async getAuction(): Promise<AuctionData> {
    const result = await this.web3Svc.l1Client.readContract({
      address: auctionAddress,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'auction',
    });
    const [hashId, amount, startTime, endTime, bidder, settled, auctionId] = result as any;
    return {
      hashId,
      amount,
      startTime: Number(startTime),
      endTime: Number(endTime),
      bidder,
      settled,
      auctionId: Number(auctionId),
    };
  }

  async getReservePrice(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'reservePrice',
    });
  }

  async getItemReservePrice(hashId: string): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'itemReservePrice',
      args: [hashId as `0x${string}`],
    });
  }

  async getPoolSize(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'poolSize',
    });
  }

  async isPaused(): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'paused',
    });
  }

  async getMinBidIncrementPercentage(): Promise<number> {
    const result = await this.web3Svc.l1Client.readContract({
      address: auctionAddress,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'minBidIncrementPercentage',
    });
    return Number(result);
  }

  async getPendingReturns(address: string): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: auctionAddress,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'pendingReturns',
      args: [address as `0x${string}`],
    });
  }

  // =========================================================
  // Contract Writes
  // =========================================================

  async createBid(valueEth: string): Promise<string | undefined> {
    await this.web3Svc.switchNetwork();

    const chainId = environment.chainId;
    let walletClient;
    try {
      walletClient = await getWalletClient(this.web3Svc.config, { chainId });
    } catch {
      await reconnect(this.web3Svc.config);
      walletClient = await getWalletClient(this.web3Svc.config, { chainId });
    }
    if (!walletClient) throw new Error('No wallet connected');

    const value = parseEther(String(valueEth));

    const hash = await walletClient.writeContract({
      address: auctionAddress,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'createBid',
      value,
      chain: walletClient.chain,
      account: walletClient.account,
    });
    return hash;
  }

  async settleAndCreate(): Promise<string | undefined> {
    await this.web3Svc.switchNetwork();

    const chainId = environment.chainId;
    let walletClient;
    try {
      walletClient = await getWalletClient(this.web3Svc.config, { chainId });
    } catch {
      await reconnect(this.web3Svc.config);
      walletClient = await getWalletClient(this.web3Svc.config, { chainId });
    }
    if (!walletClient) throw new Error('No wallet connected');

    const hash = await walletClient.writeContract({
      address: auctionAddress,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'settleAndCreate',
      chain: walletClient.chain,
      account: walletClient.account,
    });
    return hash;
  }

  async settleAuction(): Promise<string | undefined> {
    await this.web3Svc.switchNetwork();

    const chainId = environment.chainId;
    const walletClient = await getWalletClient(this.web3Svc.config, { chainId });
    if (!walletClient) throw new Error('No wallet connected');

    const hash = await walletClient.writeContract({
      address: auctionAddress,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'settleAuction',
      chain: walletClient.chain,
      account: walletClient.account,
    });
    return hash;
  }

  async withdrawReturns(): Promise<string | undefined> {
    await this.web3Svc.switchNetwork();

    const chainId = environment.chainId;
    const walletClient = await getWalletClient(this.web3Svc.config, { chainId });
    if (!walletClient) throw new Error('No wallet connected');

    const hash = await walletClient.writeContract({
      address: auctionAddress,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'withdraw',
      chain: walletClient.chain,
      account: walletClient.account,
    });
    return hash;
  }

  // =========================================================
  // Chunked event fetching (RPC block range limit workaround)
  // =========================================================

  private async getEventsPaginated(eventName: 'AuctionCreated' | 'AuctionBid' | 'AuctionExtended' | 'AuctionSettled' | 'PoolDeposited' | 'PoolWithdrawn'): Promise<any[]> {
    const latestBlock = await logsClient.getBlockNumber();
    const allLogs: any[] = [];

    for (let from = auctionDeployBlock; from <= latestBlock; from += MAX_BLOCK_RANGE) {
      const to = from + MAX_BLOCK_RANGE - 1n > latestBlock ? latestBlock : from + MAX_BLOCK_RANGE - 1n;
      const logs = await logsClient.getContractEvents({
        address: auctionAddress,
        abi: EtherPhunksAuctionHouseV2ABI,
        eventName,
        fromBlock: from,
        toBlock: to,
      });
      allLogs.push(...logs);
    }

    return allLogs;
  }

  // =========================================================
  // Event Logs (bid history)
  // =========================================================

  async getBidHistory(currentAuctionId: number): Promise<AuctionBidEvent[]> {
    try {
      // Try DB first
      const { data } = await supabase
        .from('auctionBids' + suffix)
        .select('fromAddress, amount, txHash')
        .eq('auctionId', currentAuctionId)
        .order('createdAt', { ascending: false });

      if (data?.length) {
        return data.map((b: any) => ({
          sender: b.fromAddress,
          value: BigInt(b.amount || '0'),
          txHash: b.txHash || '',
        }));
      }

      // Fall back to RPC if no DB data
      const logs = await this.getEventsPaginated('AuctionBid');
      return logs
        .filter((log: any) => Number(log.args.auctionId) === currentAuctionId)
        .map((log: any) => ({
          sender: log.args.sender,
          value: log.args.value,
          txHash: log.transactionHash,
        }))
        .reverse();
    } catch {
      return [];
    }
  }

  // =========================================================
  // Supabase: look up ethscription image by hashId
  // =========================================================

  async getEthscriptionByHashId(hashId: string): Promise<{ hashId: string; sha: string; tokenId: number; slug: string } | null> {
    const { data } = await supabase
      .from('ethscriptions' + suffix)
      .select('hashId, sha, tokenId, slug')
      .eq('hashId', hashId.toLowerCase())
      .limit(1);
    return data?.[0] || null;
  }

  // =========================================================
  // Past Auctions (for slider + navigation)
  // =========================================================

  async getSettledAuctions(): Promise<SettledAuction[]> {
    try {
      // Read settled auctions from DB instead of scanning RPC logs
      const { data: auctions } = await supabase
        .from('auctions' + suffix)
        .select('auctionId, hashId, amount, bidder, settled, createdAt')
        .eq('settled', true)
        .order('auctionId', { ascending: false });

      if (!auctions?.length) return [];

      // Batch fetch ethscription details
      const hashIds = auctions.map(a => a.hashId.toLowerCase());
      const { data: ethscriptions } = await supabase
        .from('ethscriptions' + suffix)
        .select('hashId, sha, tokenId, slug')
        .in('hashId', hashIds);
      const ethMap = new Map((ethscriptions ?? []).map(e => [e.hashId, e]));

      return auctions.map(a => {
        const eth = ethMap.get(a.hashId.toLowerCase());
        return {
          auctionId: a.auctionId,
          hashId: a.hashId,
          winner: a.bidder || '',
          amount: BigInt(a.amount || '0'),
          imageUrl: eth ? `${environment.staticUrl}/static/images/${eth.sha}` : '',
          tokenId: eth?.tokenId ?? 0,
          slug: eth?.slug ?? '',
          settledTimestamp: Math.floor(new Date(a.createdAt).getTime() / 1000),
        };
      }).filter(a => a.tokenId > 0);
    } catch {
      return [];
    }
  }

  async getAuctionCreatedEvent(auctionId: number): Promise<{ hashId: string; startTime: number; endTime: number } | null> {
    try {
      const { data } = await supabase
        .from('auctions' + suffix)
        .select('hashId, startTime, endTime')
        .eq('auctionId', auctionId)
        .limit(1);
      if (!data?.length) return null;
      return {
        hashId: data[0].hashId,
        startTime: Math.floor(new Date(data[0].startTime).getTime() / 1000),
        endTime: Math.floor(new Date(data[0].endTime).getTime() / 1000),
      };
    } catch {
      return null;
    }
  }

  async getAuctionSettledEvent(auctionId: number): Promise<{ winner: string; amount: bigint } | null> {
    try {
      const { data } = await supabase
        .from('auctions' + suffix)
        .select('bidder, amount, settled')
        .eq('auctionId', auctionId)
        .eq('settled', true)
        .limit(1);
      if (!data?.length) return null;
      return { winner: data[0].bidder, amount: BigInt(data[0].amount || '0') };
    } catch {
      return null;
    }
  }

  async getCollectionName(slug: string): Promise<string> {
    try {
      const { data } = await supabase
        .from('collections' + suffix)
        .select('singleName')
        .eq('slug', slug)
        .limit(1);
      return data?.[0]?.singleName ?? 'Phunk';
    } catch {
      return 'Phunk';
    }
  }
}
