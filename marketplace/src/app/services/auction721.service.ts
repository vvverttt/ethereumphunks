import { Injectable, inject } from '@angular/core';
import { parseEther } from 'viem';
import { getWalletClient, reconnect } from '@wagmi/core';

import { environment } from 'src/environments/environment';
import { supabase } from './supabase';
import { Web3Service } from './web3.service';
import { V67AuctionHouseABI } from '@/abi/V67AuctionHouse';
import { slugFromContract } from '@/constants/erc721c';

const suffix = environment.chainId === 1 ? '' : '_sepolia';

/** V67AuctionHouse proxy: ERC-721 auctions (v67 Dysto pool + featured queue for other collections). */
export const AUCTION721_ADDRESS = '0xE3C8d1cf63456535Ad41E47932AF1Fe1708E84C2' as const;
export const V67_NFT_ADDRESS = '0x67B850C3C8790cc7ec76261b65fde60eFb6F1fe3';

/** One auction as kept by the indexer (`auctions721`). History is always read from here: no RPC. */
export interface Auction721Row {
  auctionId: number;
  collection: string;
  tokenId: number;
  startTime: string;
  endTime: string;
  settled: boolean;
  outcome: 'sold' | 'returned' | 'skipped' | null;
  winner: string | null;
  amount: string | null;
  settledTx: string | null;
  settledAt?: string | null;
}

export interface Bid721 {
  bidder: string;
  amount: bigint;
  txHash: string;
  createdAt: string;
}

/** The live auction straight from the contract. Only read while an auction is unsettled. */
export interface Live721 {
  collection: string;
  tokenId: number;
  amount: bigint;
  bidder: string;
  startTime: number;
  endTime: number;
  settled: boolean;
  fromQueue: boolean;
  minNextBid: bigint;
  poolSize: number;
  queueSize: number;
}

/** The open auction as the small live views show it (see Auction721Service.snapshot). */
export interface Snapshot721 {
  row: Auction721Row;
  piece: Piece721;
  bidCount: number;
  topBid: bigint;
  startTime: number;
  endTime: number;
}

/** What a piece looks like on the site: resolved from the `ethscriptions` table by slug + tokenId. */
export interface Piece721 {
  slug: string | null;
  tokenId: number;
  hashId: string | null;
  sha: string | null;
}

@Injectable({ providedIn: 'root' })
export class Auction721Service {
  private readonly web3Svc = inject(Web3Service);
  private readonly pieceCache = new Map<string, Piece721>();

  readonly address = AUCTION721_ADDRESS;

  // ------------------------------------------------------------------ live snapshot (Supabase, no RPC)

  private snap?: { at: number; p: Promise<Snapshot721 | null> };

  /**
   * The open auction for the small live views (header ticker, menu card): piece, art, bid count,
   * top bid and end time, all from the indexer's tables. One read shared by every caller within
   * `maxAgeMs`, so the header and the menu card together cost one. Null when nothing is open.
   */
  snapshot(maxAgeMs = 20_000): Promise<Snapshot721 | null> {
    if (this.snap && Date.now() - this.snap.at < maxAgeMs) return this.snap.p;
    const p = (async () => {
      const [row] = await this.history(1);
      if (!row || row.settled) return null;
      const [piece, bids] = await Promise.all([this.piece(row.collection, row.tokenId), this.bids(row.auctionId)]);
      if (!piece.sha) return null;
      const top = bids.reduce((m, b) => (b.amount > m ? b.amount : m), 0n);
      return {
        row, piece, bidCount: bids.length, topBid: top,
        startTime: Math.floor(new Date(row.startTime).getTime() / 1000),
        endTime: Math.floor(new Date(row.endTime).getTime() / 1000),
      };
    })().catch(() => null);
    this.snap = { at: Date.now(), p };
    return p;
  }

  // ------------------------------------------------------------------ history (Supabase, no RPC)

  /** Most recent auctions first. `collection` narrows to one NFT contract (e.g. v67 for the Dysto page). */
  async history(limit = 60, collection?: string): Promise<Auction721Row[]> {
    let q = supabase
      .from('auctions721' + suffix)
      .select('auctionId,collection,tokenId,startTime,endTime,settled,outcome,winner,amount,settledTx,settledAt')
      .order('auctionId', { ascending: false })
      .limit(limit);
    if (collection) q = q.eq('collection', collection.toLowerCase());
    const { data, error } = await q;
    if (error) { console.warn('auctions721', error.message); return []; }
    return (data || []).map((r: any) => ({ ...r, tokenId: Number(r.tokenId) }));
  }

  /** One auction by id (for browsing back past the loaded page of history). */
  async byId(auctionId: number): Promise<Auction721Row | null> {
    const { data } = await supabase
      .from('auctions721' + suffix)
      .select('auctionId,collection,tokenId,startTime,endTime,settled,outcome,winner,amount,settledTx,settledAt')
      .eq('auctionId', auctionId)
      .limit(1);
    const r: any = data?.[0];
    return r ? { ...r, tokenId: Number(r.tokenId) } : null;
  }

  /** The collection's display name (same lookup the Ethscriptions house uses). */
  async collectionName(slug: string | null): Promise<string> {
    if (!slug) return 'Phunk';
    try {
      const { data } = await supabase.from('collections' + suffix).select('singleName').eq('slug', slug).limit(1);
      return data?.[0]?.singleName ?? 'Phunk';
    } catch {
      return 'Phunk';
    }
  }

  /** Bids for one auction, highest first. */
  async bids(auctionId: number): Promise<Bid721[]> {
    const { data, error } = await supabase
      .from('auctionBids721' + suffix)
      .select('bidder,amount,txHash,createdAt')
      .eq('auctionId', auctionId)
      .order('amount', { ascending: false });
    if (error) { console.warn('auctionBids721', error.message); return []; }
    return (data || []).map((b: any) => ({ ...b, amount: BigInt(b.amount) }));
  }

  /** Count of pieces sold (all, or one collection). */
  async soldCount(collection?: string): Promise<number> {
    let q = supabase.from('auctions721' + suffix).select('auctionId', { count: 'exact', head: true }).eq('outcome', 'sold');
    if (collection) q = q.eq('collection', collection.toLowerCase());
    const { count } = await q;
    return count ?? 0;
  }

  /**
   * True when the indexer has an auction open (created, not settled). This is the gate for every
   * RPC read on the ERC-721 pages: no open auction, no contract reads at all.
   */
  isOpen(rows: Auction721Row[]): boolean {
    return !!rows.length && !rows[0].settled;
  }

  // ------------------------------------------------------------------ pieces

  async piece(collection: string, tokenId: number): Promise<Piece721> {
    const slug = slugFromContract(collection) ?? null;
    const key = `${collection.toLowerCase()}:${tokenId}`;
    const hit = this.pieceCache.get(key);
    if (hit) return hit;
    let out: Piece721 = { slug, tokenId, hashId: null, sha: null };
    if (slug) {
      const { data } = await supabase
        .from('ethscriptions' + suffix)
        .select('hashId,sha,tokenId')
        .eq('slug', slug)
        .eq('tokenId', tokenId)
        .limit(1);
      if (data?.[0]) out = { slug, tokenId, hashId: data[0].hashId, sha: data[0].sha };
    }
    this.pieceCache.set(key, out);
    return out;
  }

  /** Resolve many at once (one query per collection). */
  async pieces(items: { collection: string; tokenId: number }[]): Promise<Map<string, Piece721>> {
    const out = new Map<string, Piece721>();
    const byColl = new Map<string, number[]>();
    for (const it of items) {
      const key = `${it.collection.toLowerCase()}:${it.tokenId}`;
      const hit = this.pieceCache.get(key);
      if (hit) { out.set(key, hit); continue; }
      const list = byColl.get(it.collection.toLowerCase()) || [];
      list.push(it.tokenId);
      byColl.set(it.collection.toLowerCase(), list);
    }
    for (const [coll, ids] of byColl) {
      const slug = slugFromContract(coll) ?? null;
      const rows: any[] = [];
      if (slug) {
        for (let i = 0; i < ids.length; i += 200) {
          const { data } = await supabase
            .from('ethscriptions' + suffix)
            .select('hashId,sha,tokenId')
            .eq('slug', slug)
            .in('tokenId', ids.slice(i, i + 200));
          rows.push(...(data || []));
        }
      }
      for (const id of ids) {
        const r = rows.find((x) => Number(x.tokenId) === id);
        const p: Piece721 = { slug, tokenId: id, hashId: r?.hashId ?? null, sha: r?.sha ?? null };
        const key = `${coll}:${id}`;
        this.pieceCache.set(key, p);
        out.set(key, p);
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ live (RPC, only while open)

  async live(): Promise<Live721> {
    const c = this.web3Svc.l1DedicatedClient as any;
    const results = await c.multicall({
      contracts: [
        { address: AUCTION721_ADDRESS, abi: V67AuctionHouseABI, functionName: 'currentAuction' },
        { address: AUCTION721_ADDRESS, abi: V67AuctionHouseABI, functionName: 'minNextBid' },
        { address: AUCTION721_ADDRESS, abi: V67AuctionHouseABI, functionName: 'poolSize' },
        { address: AUCTION721_ADDRESS, abi: V67AuctionHouseABI, functionName: 'queueSize' },
      ],
      allowFailure: false,
    });
    const [collection, tokenId, amount, bidder, startTime, endTime, settled, fromQueue] = results[0] as any[];
    return {
      collection: String(collection),
      tokenId: Number(tokenId),
      amount: BigInt(amount),
      bidder: String(bidder),
      startTime: Number(startTime),
      endTime: Number(endTime),
      settled: Boolean(settled),
      fromQueue: Boolean(fromQueue),
      minNextBid: BigInt(results[1] as bigint),
      poolSize: Number(results[2]),
      queueSize: Number(results[3]),
    };
  }

  // ------------------------------------------------------------------ writes (wallet)

  private async wallet() {
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
    return walletClient;
  }

  /** Bid on the live auction. Names the collection AND token id, so a bid can never land on another piece. */
  async createBid(collection: string, tokenId: number, valueEth: string): Promise<string> {
    const w = await this.wallet();
    return w.writeContract({
      address: AUCTION721_ADDRESS,
      abi: V67AuctionHouseABI,
      functionName: 'createBid',
      args: [collection as `0x${string}`, BigInt(tokenId)],
      value: parseEther(String(valueEth)),
      chain: w.chain,
      account: w.account!,
    });
  }

  /** Anyone can settle an ended auction; it opens the next one in the same transaction. */
  async settle(): Promise<string> {
    const w = await this.wallet();
    return w.writeContract({
      address: AUCTION721_ADDRESS,
      abi: V67AuctionHouseABI,
      functionName: 'settleCurrentAndCreateNewAuction',
      chain: w.chain,
      account: w.account!,
    });
  }
}
