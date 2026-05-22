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
// Alchemy Free allows at most a 10-block range per eth_getLogs request.
const MAX_BLOCK_RANGE = 10n;

// Dedicated client for eth_getLogs
const logsClient = createPublicClient({
  chain: mainnet,
  transport: fallback([
    http('https://rpc.ankr.com/eth/545e600765426a4f17b1d59db878210f81e6fecbe581c0a745a7068c62fc1eb8'),
    http('https://rpc.ankr.com/eth/229b890a1dea15c5330378688e793eb0c44185c264c00144c928240d7cb0ec3f'),
    ...((environment as any).frontendBackupRpcUrl ? [http((environment as any).frontendBackupRpcUrl)] : []),
    http((environment as any).receiptRpcUrl || environment.rpcHttpProvider),
    http(environment.rpcHttpProvider),
  ], { rank: false, retryCount: 0 }),
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

@Injectable()
export class AuctionService {

  // Cache for values that rarely change
  private cachedReservePrice: bigint | null = null;
  private cachedMinBidIncrement: number | null = null;

  // Allow overriding the auction address (for auction house 2)
  private _addressOverride: `0x${string}` | null = null;
  get address(): `0x${string}` { return this._addressOverride || auctionAddress; }
  setAddress(addr: string) { this._addressOverride = addr as `0x${string}`; }

  constructor(
    private web3Svc: Web3Service,
  ) {}

  // =========================================================
  // Batch read — single multicall for all initial data
  // =========================================================

  async getInitialData(): Promise<{
    auction: AuctionData;
    poolSize: bigint;
    reservePrice: bigint;
    minBidIncrement: number;
  }> {
    // Try cache first (10s TTL)
    try {
      const cacheKey = `auction_initial_${this.address}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 10000) {
          // Revive bigints from string
          return {
            auction: { ...data.auction, amount: BigInt(data.auction.amount) },
            poolSize: BigInt(data.poolSize),
            reservePrice: BigInt(data.reservePrice),
            minBidIncrement: data.minBidIncrement,
          };
        }
      }
    } catch {}

    const results = await this.web3Svc.l1DedicatedClient.multicall({
      contracts: [
        { address: this.address, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'auction' },
        { address: this.address, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'poolSize' },
        { address: this.address, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'reservePrice' },
        { address: this.address, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'minBidIncrementPercentage' },
      ],
    });

    const [hashId, amount, startTime, endTime, bidder, settled, auctionId] = results[0].result as any;
    const auction: AuctionData = {
      hashId, amount,
      startTime: Number(startTime),
      endTime: Number(endTime),
      bidder, settled,
      auctionId: Number(auctionId),
    };

    const reservePrice = (results[2].result as bigint) || 0n;
    const minBidIncrement = Number(results[3].result || 10);

    this.cachedReservePrice = reservePrice;
    this.cachedMinBidIncrement = minBidIncrement;

    const result = {
      auction,
      poolSize: (results[1].result as bigint) || 0n,
      reservePrice,
      minBidIncrement,
    };

    // Save to cache
    try {
      const cacheKey = `auction_initial_${this.address}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        data: {
          auction: { ...auction, amount: auction.amount.toString() },
          poolSize: result.poolSize.toString(),
          reservePrice: reservePrice.toString(),
          minBidIncrement,
        },
        ts: Date.now(),
      }));
    } catch {}

    return result;
  }

  // =========================================================
  // Contract Reads
  // =========================================================

  async getAuction(): Promise<AuctionData> {
    const result = await this.web3Svc.l1DedicatedClient.readContract({
      address: this.address,
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
    return await this.web3Svc.l1DedicatedClient.readContract({
      address: this.address,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'reservePrice',
    });
  }

  async getItemReservePrice(hashId: string): Promise<bigint> {
    return await this.web3Svc.l1DedicatedClient.readContract({
      address: this.address,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'itemReservePrice',
      args: [hashId as `0x${string}`],
    });
  }

  async getPoolSize(): Promise<bigint> {
    return await this.web3Svc.l1DedicatedClient.readContract({
      address: this.address,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'poolSize',
    });
  }

  async isPaused(): Promise<boolean> {
    return await this.web3Svc.l1DedicatedClient.readContract({
      address: this.address,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'paused',
    });
  }

  async getMinBidIncrementPercentage(): Promise<number> {
    const result = await this.web3Svc.l1DedicatedClient.readContract({
      address: this.address,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'minBidIncrementPercentage',
    });
    return Number(result);
  }

  async getPendingReturns(address: string): Promise<bigint> {
    return await this.web3Svc.l1DedicatedClient.readContract({
      address: this.address,
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
      address: this.address,
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
      address: this.address,
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
      address: this.address,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'settleAuction',
      chain: walletClient.chain,
      account: walletClient.account,
    });
    return hash;
  }

  async getOwner(): Promise<string> {
    const result = await this.web3Svc.l1DedicatedClient.readContract({
      address: this.address,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'owner',
    });
    return (result as string).toLowerCase();
  }

  async withdrawFromPoolBatch(hashIds: string[]): Promise<string | undefined> {
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
      address: this.address,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'withdrawFromPoolBatch',
      args: [hashIds as `0x${string}`[]],
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
      address: this.address,
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
        address: this.address,
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
      // Check if this auction is indexed — if so, trust DB result (even 0 bids is valid)
      const [bidsResult, auctionResult] = await Promise.all([
        supabase
          .from('auctionBids' + suffix)
          .select('fromAddress, amount, txHash')
          .eq('auctionId', currentAuctionId)
          .eq('contractAddress', this.address.toLowerCase())
          .order('createdAt', { ascending: false }),
        supabase
          .from('auctions' + suffix)
          .select('auctionId')
          .eq('auctionId', currentAuctionId)
          .eq('contractAddress', this.address.toLowerCase())
          .limit(1),
      ]);

      // Return whatever bids the indexer has — DB is authoritative.
      // No RPC fallback: eth_getLogs over thousands of blocks hammers Alchemy.
      return (bidsResult.data || []).map((b: any) => ({
        sender: b.fromAddress,
        value: BigInt(b.amount || '0'),
        txHash: b.txHash || '',
      }));
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
      // Read settled auctions from DB, filtered by contract address
      const { data: auctions } = await supabase
        .from('auctions' + suffix)
        .select('auctionId, hashId, amount, bidder, settled, createdAt')
        .eq('settled', true)
        .eq('contractAddress', this.address.toLowerCase())
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
      }).filter(a => !!a.imageUrl);
    } catch {
      return [];
    }
  }

  async getCurrentAuctionFromDB(): Promise<AuctionData | null> {
    try {
      const { data } = await supabase
        .from('auctions' + suffix)
        .select('auctionId, hashId, amount, bidder, startTime, endTime, settled')
        .eq('settled', false)
        .eq('contractAddress', this.address.toLowerCase())
        .order('auctionId', { ascending: false })
        .limit(1);
      if (!data?.length) return null;
      const row = data[0];
      return {
        auctionId: row.auctionId,
        hashId: row.hashId,
        amount: BigInt(row.amount || '0'),
        bidder: row.bidder,
        startTime: Math.floor(new Date(row.startTime).getTime() / 1000),
        endTime: Math.floor(new Date(row.endTime).getTime() / 1000),
        settled: row.settled,
      };
    } catch {
      return null;
    }
  }

  async getAuctionCreatedEvent(auctionId: number): Promise<{ hashId: string; startTime: number; endTime: number } | null> {
    try {
      const { data } = await supabase
        .from('auctions' + suffix)
        .select('hashId, startTime, endTime')
        .eq('auctionId', auctionId)
        .eq('contractAddress', this.address.toLowerCase())
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
        .eq('contractAddress', this.address.toLowerCase())
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
