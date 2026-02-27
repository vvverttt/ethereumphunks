import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { formatEther, parseEther, decodeEventLog } from 'viem';
import { getWalletClient, getChainId, getPublicClient, reconnect } from '@wagmi/core';

import { environment } from 'src/environments/environment';
import { Web3Service } from './web3.service';
import { EtherPhunksAuctionHouseV2ABI } from '@/abi/EtherPhunksAuctionHouseV2';

const supabaseUrl = environment.supabaseUrl;
const supabaseKey = environment.supabaseKey;
const supabase = createClient(supabaseUrl, supabaseKey);
const suffix = environment.chainId === 1 ? '' : '_sepolia';
const auctionAddress = (environment as any).auctionAddress as `0x${string}`;
const auctionDeployBlock = ((environment as any).auctionDeployBlock as bigint) || 0n;

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
  // Event Logs (bid history)
  // =========================================================

  async getBidHistory(currentAuctionId: number): Promise<AuctionBidEvent[]> {
    try {
      const logs = await this.web3Svc.l1Client.getContractEvents({
        address: auctionAddress,
        abi: EtherPhunksAuctionHouseV2ABI,
        eventName: 'AuctionBid',
        fromBlock: auctionDeployBlock,
      });

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
      const logs = await this.web3Svc.l1Client.getContractEvents({
        address: auctionAddress,
        abi: EtherPhunksAuctionHouseV2ABI,
        eventName: 'AuctionSettled',
        fromBlock: auctionDeployBlock,
      });

      if (!logs.length) return [];

      // Batch fetch all ethscriptions in one Supabase query
      const hashIds = logs.map((log: any) => log.args.hashId.toLowerCase());
      const { data: ethscriptions } = await supabase
        .from('ethscriptions' + suffix)
        .select('hashId, sha, tokenId, slug')
        .in('hashId', hashIds);
      const ethMap = new Map((ethscriptions ?? []).map(e => [e.hashId, e]));

      // Batch fetch all block timestamps in parallel
      const uniqueBlocks = [...new Set(logs.map(l => l.blockNumber).filter(Boolean))] as bigint[];
      const blockResults = await Promise.all(
        uniqueBlocks.map(bn => this.web3Svc.l1Client.getBlock({ blockNumber: bn }).catch(() => null))
      );
      const blockTimestamps = new Map<bigint, number>();
      uniqueBlocks.forEach((bn, i) => {
        if (blockResults[i]) blockTimestamps.set(bn, Number(blockResults[i]!.timestamp));
      });

      return logs.map((log: any) => {
        const args = log.args;
        const eth = ethMap.get(args.hashId.toLowerCase());
        return {
          auctionId: Number(args.auctionId),
          hashId: args.hashId,
          winner: args.winner,
          amount: args.amount,
          imageUrl: eth ? `${environment.staticUrl}/static/images/${eth.sha}` : '',
          tokenId: eth?.tokenId ?? 0,
          slug: eth?.slug ?? '',
          settledTimestamp: log.blockNumber ? (blockTimestamps.get(log.blockNumber) ?? 0) : 0,
        };
      }).sort((a, b) => b.auctionId - a.auctionId);
    } catch {
      return [];
    }
  }

  async getAuctionCreatedEvent(auctionId: number): Promise<{ hashId: string; startTime: number; endTime: number } | null> {
    try {
      const logs = await this.web3Svc.l1Client.getContractEvents({
        address: auctionAddress,
        abi: EtherPhunksAuctionHouseV2ABI,
        eventName: 'AuctionCreated',
        fromBlock: auctionDeployBlock,
      });
      const match = logs.find((log: any) => Number(log.args.auctionId) === auctionId);
      if (!match) return null;
      const args = match.args as any;
      return {
        hashId: args.hashId,
        startTime: Number(args.startTime),
        endTime: Number(args.endTime),
      };
    } catch {
      return null;
    }
  }

  async getAuctionSettledEvent(auctionId: number): Promise<{ winner: string; amount: bigint } | null> {
    try {
      const logs = await this.web3Svc.l1Client.getContractEvents({
        address: auctionAddress,
        abi: EtherPhunksAuctionHouseV2ABI,
        eventName: 'AuctionSettled',
        fromBlock: auctionDeployBlock,
      });
      const match = logs.find((log: any) => Number(log.args.auctionId) === auctionId);
      if (!match) return null;
      const args = match.args as any;
      return { winner: args.winner, amount: args.amount };
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
