import { Injectable } from '@angular/core';
import { Observable, from, merge, map, switchMap } from 'rxjs';
import { formatEther, parseGwei } from 'viem';
import { getWalletClient } from '@wagmi/core';

import { environment } from 'src/environments/environment';
import { supabase } from './supabase';
import { Web3Service } from './web3.service';
import { PhilipLotteryV67Erc721ABI } from '@/abi/PhilipLotteryV67Erc721';
import { LotteryWin } from '@/models/lottery';

const suffix = environment.chainId === 1 ? '' : '_sepolia';
const lotteryAddress = ((environment as any).lotteryAddress || '') as `0x${string}`;

/** The QuantumPhunks ERC-721 collection slug (prizes resolve their image via this collection). */
const PRIZE_SLUG = 'cryptophunksv67';

export interface SurrenderCollection {
  address: `0x${string}`;
  label: string;
}

export interface OwnedNft {
  collection: `0x${string}`;
  collectionLabel: string;
  tokenId: number;
  imageUrl: string;
  discountWei: bigint;
  selected: boolean;
}

/**
 * Service for the ERC-721 QuantumPhunks mint lottery (`PhilipLotteryV67Erc721`).
 *
 * A "play" is a single `requestMint(quantity, surrenderCollections, surrenderTokenIds)`
 * transaction that pays `mintPrice × quantity` (minus any surrender/whitelist discount)
 * plus the Chainlink VRF fee. The winning tokenId(s) are chosen by the VRF callback and
 * emitted as `RandomMinted`; the indexer records them into `lottery_wins`, which the
 * frontend watches via Supabase realtime (no RPC log-polling).
 */
@Injectable({
  providedIn: 'root'
})
export class LotteryService {

  private _address: `0x${string}` = lotteryAddress;

  get address(): `0x${string}` { return this._address; }

  /** Collections a holder may surrender for an ETH discount (from environment; eligibility still read on-chain). */
  get surrenderCollections(): SurrenderCollection[] {
    return (((environment as any).lotterySurrenderCollections || []) as SurrenderCollection[])
      .map(c => ({ address: c.address.toLowerCase() as `0x${string}`, label: c.label }));
  }

  setAddress(address: `0x${string}`) {
    this._address = address;
  }

  constructor(
    private web3Svc: Web3Service,
  ) {}

  // =========================================================
  // Contract Reads (dedicated lottery/auction RPC client)
  // =========================================================

  private read<T = any>(functionName: string, args: any[] = []): Promise<T> {
    return this.web3Svc.l1DedicatedClient.readContract({
      address: this._address,
      abi: PhilipLotteryV67Erc721ABI,
      functionName: functionName as any,
      args: args as any,
    }) as Promise<T>;
  }

  /** Base mint price per token (before any discount), in wei. */
  async getMintPrice(): Promise<bigint> { return this.read<bigint>('mintPrice'); }
  async getMintPriceFormatted(): Promise<string> { return formatEther(await this.getMintPrice()); }

  async isActive(): Promise<boolean> { return this.read<boolean>('lotteryActive'); }
  async getPoolSize(): Promise<bigint> { return this.read<bigint>('poolSize'); }
  async getMaxBatchSize(): Promise<number> { return Number(await this.read<number>('maxBatchSize')); }
  async getMaxPerWallet(): Promise<number> { return Number(await this.read<number>('maxPerWallet')); }
  async getMintsOf(address: string): Promise<number> { return Number(await this.read<bigint>('lotteryMintsOf', [address])); }
  async getOwner(): Promise<string> { return this.read<string>('owner'); }

  async isWhitelistEnabled(): Promise<boolean> { return this.read<boolean>('whitelistEnabled'); }
  async isWhitelisted(address: string): Promise<boolean> { return this.read<boolean>('whitelisted', [address]); }
  async isDiscountsEnabled(): Promise<boolean> { return this.read<boolean>('discountsEnabled'); }

  /** Pool items are uint256 tokenIds (not hashId strings like the old lottery). */
  async getPoolItems(offset: number, limit: number): Promise<number[]> {
    const result = await this.read<bigint[]>('poolItems', [BigInt(offset), BigInt(limit)]);
    return (result || []).map(id => Number(id));
  }

  async getPendingRefunds(address: string): Promise<bigint> {
    return this.read<bigint>('pendingRefunds', [address]);
  }

  /** Raw ETH held by the lottery contract. */
  async getContractBalance(): Promise<bigint> {
    return this.web3Svc.l1DedicatedClient.getBalance({ address: this._address });
  }

  /** Owner-withdrawable surplus = balance − pending refunds − in-flight committed ETH. */
  async getWithdrawableSurplus(): Promise<bigint> {
    const [balance, refunds, committed] = await Promise.all([
      this.getContractBalance(),
      this.read<bigint>('totalPendingRefunds').catch(() => 0n),
      this.read<bigint>('totalCommittedETH').catch(() => 0n),
    ]);
    const surplus = balance - refunds - committed;
    return surplus > 0n ? surplus : 0n;
  }

  /** Toggle active without changing price/batch. */
  async setActive(active: boolean): Promise<string | undefined> {
    const [price, maxBatch] = await Promise.all([this.getMintPrice(), this.getMaxBatchSize()]);
    const walletClient = await this.wallet();
    return await walletClient.writeContract({
      address: this._address, abi: PhilipLotteryV67Erc721ABI, functionName: 'setLotteryConfig',
      args: [price, maxBatch, active], chain: walletClient.chain, account: walletClient.account,
    });
  }

  /** ETH discount (wei) for surrendering a specific (collection, tokenId). 0 = not eligible. */
  async getDiscountForToken(collection: string, tokenId: number): Promise<bigint> {
    try { return await this.read<bigint>('discountForToken', [collection, BigInt(tokenId)]); }
    catch { return 0n; }
  }

  /** True if this collection is configured as surrender-eligible (collectionUnits > 0). */
  async isDiscountCollection(collection: string): Promise<boolean> {
    try { return Number(await this.read<number>('collectionUnits', [collection])) > 0; }
    catch { return false; }
  }

  async getUnitValue(): Promise<bigint> {
    try { return await this.read<bigint>('unitValue'); } catch { return 0n; }
  }
  async getCollectionUnits(collection: string): Promise<number> {
    try { return Number(await this.read<number>('collectionUnits', [collection])); } catch { return 0; }
  }
  /** Approx per-NFT discount for a collection (units × unitValue). Exact per-token value (rare-trait
   *  overrides) is applied on-chain by `quote` at mint time — this is just for picker display. */
  async getCollectionDefaultDiscount(collection: string): Promise<bigint> {
    const [units, unitValue] = await Promise.all([this.getCollectionUnits(collection), this.getUnitValue()]);
    return BigInt(units) * unitValue;
  }

  /**
   * Mint payment (wei, VRF fee excluded) for `quantity` after subtracting the value of the
   * surrendered NFTs + any whitelist discount. Mirrors the contract's `quote`, so it reverts
   * `CreditExceedsOrder` if the surrender is worth more than the order.
   */
  async getQuote(player: string, quantity: number, collections: string[], tokenIds: number[]): Promise<bigint> {
    return this.read<bigint>('quote', [player, quantity, collections, tokenIds.map(t => BigInt(t))]);
  }

  /** On-chain VRF fee read (best-effort — priced from tx.gasprice, so ~0 in an eth_call). */
  async getVRFCostOnchain(): Promise<bigint> {
    try { return await this.read<bigint>('getVRFCost'); } catch { return 0n; }
  }

  /**
   * Total cost for a play. The VRF fee read on-chain is unreliable in an eth_call (priced from
   * tx.gasprice = 0), so we ALSO estimate it client-side and take the larger. The contract refunds
   * any overpayment in the same tx, so padding costs the player nothing.
   */
  async getTotalCost(player: string, quantity: number, collections: string[], tokenIds: number[]): Promise<{ mintPayment: bigint; vrfCost: bigint; total: bigint }> {
    const mintPayment = await this.getQuote(player, quantity, collections, tokenIds);
    const fee = await this.web3Svc.l1Client.estimateFeesPerGas();
    const gasBasis = (fee.maxFeePerGas && fee.maxFeePerGas > 0n) ? fee.maxFeePerGas : parseGwei('20');
    // 500k VRF callback + ~200k wrapper/coordinator overhead + margin ≈ 700k gas; 24% native premium
    const vrfEstimate = (700000n * gasBasis * 124n) / 100n;
    const onchain = await this.getVRFCostOnchain();
    const vrfCost = onchain > vrfEstimate ? onchain : vrfEstimate;
    return { mintPayment, vrfCost, total: mintPayment + vrfCost };
  }

  // =========================================================
  // Contract Writes
  // =========================================================

  private async wallet() {
    await this.web3Svc.switchNetwork();
    const walletClient = await getWalletClient(this.web3Svc.config, { chainId: environment.chainId });
    if (!walletClient) throw new Error('No wallet connected');
    return walletClient;
  }

  private async priorityFee(): Promise<bigint> {
    const feeData = await this.web3Svc.l1Client.estimateFeesPerGas();
    const minPriority = parseGwei('0.1');
    return feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas > minPriority
      ? feeData.maxPriorityFeePerGas : minPriority;
  }

  /**
   * Ensure the lottery is approved (setApprovalForAll) to pull each surrender collection's NFTs.
   * No-op for collections already approved. Must run before `requestMint` with surrenders.
   */
  async ensureSurrenderApprovals(collections: string[]): Promise<void> {
    const unique = Array.from(new Set(collections.map(c => c.toLowerCase())));
    for (const c of unique) {
      await this.web3Svc.qpEnsureApproval(c, this._address);
    }
  }

  /**
   * Single-tx play: requestMint(quantity, surrenderCollections, surrenderTokenIds), paying
   * mintPayment + VRF fee (+ buffer for gas-price drift; refunded by the contract). The prize
   * is assigned later by the VRF callback — watch `lottery_wins` for the resulting rows.
   */
  async requestMint(quantity: number, collections: string[], tokenIds: number[]): Promise<string | undefined> {
    const walletClient = await this.wallet();
    const player = walletClient.account.address;

    const { mintPayment, vrfCost } = await this.getTotalCost(player, quantity, collections, tokenIds);
    // 25% buffer on the VRF fee to absorb gas-price drift between read and mine; refunded if unused.
    const value = mintPayment + vrfCost + (vrfCost / 4n);

    const hash = await walletClient.writeContract({
      address: this._address,
      abi: PhilipLotteryV67Erc721ABI,
      functionName: 'requestMint',
      args: [quantity, collections.map(c => c as `0x${string}`), tokenIds.map(t => BigInt(t))],
      value,
      chain: walletClient.chain,
      account: walletClient.account,
      maxPriorityFeePerGas: await this.priorityFee(),
    });
    console.log('[Lottery] requestMint tx hash:', hash);
    return hash;
  }

  /** Withdraw ETH stuck in the pull ledger (refunds from a cancelled/stuck spin). */
  async withdrawRefund(): Promise<string | undefined> {
    const walletClient = await this.wallet();
    return await walletClient.writeContract({
      address: this._address,
      abi: PhilipLotteryV67Erc721ABI,
      functionName: 'withdrawRefund',
      chain: walletClient.chain,
      account: walletClient.account,
      maxPriorityFeePerGas: await this.priorityFee(),
    });
  }

  /** Recover a stuck play whose VRF callback never landed (self-refund after the on-chain delay). */
  async refundStuckSpin(requestId: bigint): Promise<string | undefined> {
    const walletClient = await this.wallet();
    return await walletClient.writeContract({
      address: this._address,
      abi: PhilipLotteryV67Erc721ABI,
      functionName: 'refundStuckSpin',
      args: [requestId],
      chain: walletClient.chain,
      account: walletClient.account,
    });
  }

  getBlockNumber(): Promise<bigint> { return this.web3Svc.l1Client.getBlockNumber(); }

  // =========================================================
  // Owner-only Writes
  // =========================================================

  async addPoolTokens(tokenIds: number[]): Promise<string | undefined> {
    const walletClient = await this.wallet();
    return await walletClient.writeContract({
      address: this._address, abi: PhilipLotteryV67Erc721ABI, functionName: 'addPoolTokens',
      args: [tokenIds.map(t => BigInt(t))], chain: walletClient.chain, account: walletClient.account,
    });
  }

  async mintRemaining(to: string, maxCount: number): Promise<string | undefined> {
    const walletClient = await this.wallet();
    return await walletClient.writeContract({
      address: this._address, abi: PhilipLotteryV67Erc721ABI, functionName: 'mintRemaining',
      args: [to as `0x${string}`, BigInt(maxCount)], chain: walletClient.chain, account: walletClient.account,
    });
  }

  async withdrawSurplusETH(to: string, amount: bigint): Promise<string | undefined> {
    const walletClient = await this.wallet();
    return await walletClient.writeContract({
      address: this._address, abi: PhilipLotteryV67Erc721ABI, functionName: 'withdrawSurplusETH',
      args: [to as `0x${string}`, amount], chain: walletClient.chain, account: walletClient.account,
    });
  }

  // =========================================================
  // Owned-NFT lookup for the surrender picker (Alchemy NFT API)
  // =========================================================

  /** Base URL + key for Alchemy's NFT API, derived from the configured RPC (domain-locked key). */
  private alchemyNftBase(): string | null {
    const rpc = ((environment as any).frontendBackupRpcUrl || environment.rpcHttpProvider || '') as string;
    if (!rpc.includes('alchemy.com') || !rpc.includes('/v2/')) return null;
    return rpc.replace('/v2/', '/nft/v3/');
  }

  /**
   * TokenIds an address owns in `collection`, via Alchemy `getNFTsForOwner` (one HTTP call,
   * not RPC log-scanning). Returns [] if the NFT API isn't reachable (e.g. localhost/CORS).
   */
  async getOwnedTokenIds(owner: string, collection: string): Promise<number[]> {
    const base = this.alchemyNftBase();
    if (!base) return [];
    const ids: number[] = [];
    let pageKey: string | undefined;
    try {
      do {
        const url = new URL(`${base}/getNFTsForOwner`);
        url.searchParams.set('owner', owner);
        url.searchParams.append('contractAddresses[]', collection);
        url.searchParams.set('withMetadata', 'false');
        url.searchParams.set('pageSize', '100');
        if (pageKey) url.searchParams.set('pageKey', pageKey);
        const res = await fetch(url.toString());
        if (!res.ok) break;
        const data = await res.json();
        for (const nft of (data.ownedNfts || [])) {
          const id = Number(nft.tokenId ?? nft.id?.tokenId);
          if (Number.isFinite(id)) ids.push(id);
        }
        pageKey = data.pageKey;
      } while (pageKey && ids.length < 1000);
    } catch (err) {
      console.warn('[Lottery] getOwnedTokenIds failed:', err);
    }
    return ids;
  }

  // =========================================================
  // Supabase Queries (prizes resolve their image via the ethscriptions table)
  // =========================================================

  async getEthscriptionsByTokenIds(tokenIds: number[]): Promise<{ hashId: string; sha: string; tokenId: number; slug: string }[]> {
    if (!tokenIds.length) return [];
    const { data } = await supabase
      .from('ethscriptions' + suffix)
      .select('hashId, sha, tokenId, slug')
      .eq('slug', PRIZE_SLUG)
      .in('tokenId', tokenIds);
    return data || [];
  }

  async getEthscriptionByTokenId(tokenId: number): Promise<{ hashId: string; sha: string; tokenId: number; slug: string } | null> {
    const { data } = await supabase
      .from('ethscriptions' + suffix)
      .select('hashId, sha, tokenId, slug')
      .eq('slug', PRIZE_SLUG)
      .eq('tokenId', tokenId)
      .limit(1);
    return data?.[0] || null;
  }

  async getRandomPoolItems(count: number): Promise<any[]> {
    const { data } = await supabase
      .from('ethscriptions')
      .select('hashId, sha, tokenId, slug')
      .eq('slug', PRIZE_SLUG)
      .not('sha', 'is', null)
      .not('sha', 'eq', '')
      .limit(count);
    return data || [];
  }

  // =========================================================
  // Wins (written by the indexer from RandomMinted; watched via Supabase realtime)
  // =========================================================

  fetchRecentWins(): Observable<LotteryWin[]> {
    const addr = this._address.toLowerCase();
    const query$ = from(
      supabase
        .from('lottery_wins' + suffix)
        .select('id,contract_address,play_id,winner,hash_id,sha,token_id,collection_slug,transfer_status,tx_hash,created_at')
        .eq('contract_address', addr)
        .order('created_at', { ascending: false })
        .limit(20)
    ).pipe(map(r => (r.data || []) as LotteryWin[]));

    const changes$ = new Observable<void>(subscriber => {
      const channel = supabase
        .channel('lottery_wins_changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lottery_wins' + suffix }, () => subscriber.next())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    });

    return merge(query$, changes$.pipe(switchMap(() => query$)));
  }

  fetchAllWins(): Observable<LotteryWin[]> {
    const addr = this._address.toLowerCase();
    const query$ = from(
      supabase
        .from('lottery_wins' + suffix)
        .select('id,contract_address,play_id,winner,hash_id,sha,token_id,collection_slug,transfer_status,tx_hash,created_at')
        .eq('contract_address', addr)
        .order('created_at', { ascending: false })
        .limit(5000)
    ).pipe(map(r => (r.data || []) as LotteryWin[]));

    const changes$ = new Observable<void>(subscriber => {
      const channel = supabase
        .channel('lottery_all_wins_changes')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lottery_wins' + suffix }, () => subscriber.next())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    });

    return merge(query$, changes$.pipe(switchMap(() => query$)));
  }

  fetchTotalWinsCount(): Observable<number> {
    const addr = this._address.toLowerCase();
    return from(
      supabase
        .from('lottery_wins' + suffix)
        .select('*', { count: 'exact', head: true })
        .eq('contract_address', addr)
    ).pipe(map(r => r.count ?? 0));
  }

  /**
   * Wait for the VRF result: the indexer writes one `lottery_wins` row per won tokenId
   * (keyed by winner + contract). We watch Supabase realtime + poll (no RPC log-scanning)
   * until `quantity` rows created at/after `sinceMs` arrive, then resolve them.
   */
  watchForWins(winner: string, sinceMs: number, quantity: number, timeoutMs = 180000): Promise<LotteryWin[]> {
    const w = winner.toLowerCase();
    const contract = this._address.toLowerCase();
    return new Promise((resolve) => {
      const found = new Map<number, LotteryWin>(); // token_id -> row
      let settled = false;
      const matches = (row: LotteryWin) =>
        row.winner?.toLowerCase() === w &&
        row.contract_address?.toLowerCase() === contract &&
        new Date(row.created_at).getTime() >= sinceMs - 5000;

      const finish = () => {
        if (settled) return;
        settled = true;
        supabase.removeChannel(channel);
        clearInterval(pollTimer);
        clearTimeout(timer);
        resolve(Array.from(found.values()).sort((a, b) => a.play_id - b.play_id));
      };

      const consider = (rows: LotteryWin[]) => {
        for (const row of rows) {
          if (matches(row)) found.set(row.token_id, row);
        }
        if (found.size >= quantity) finish();
      };

      const channel = supabase
        .channel(`lottery_win_addr_${w.slice(0, 10)}_${sinceMs}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lottery_wins' + suffix },
          (payload: any) => consider([payload.new as LotteryWin]))
        .subscribe();

      const pollTimer = setInterval(async () => {
        const { data } = await supabase
          .from('lottery_wins' + suffix)
          .select('id,contract_address,play_id,winner,hash_id,sha,token_id,collection_slug,transfer_status,tx_hash,created_at')
          .eq('winner', w)
          .eq('contract_address', contract)
          .order('created_at', { ascending: false })
          .limit(quantity + 4);
        if (data) consider(data as LotteryWin[]);
      }, 2500);

      // Resolve with whatever we have when the window closes (component handles empty).
      const timer = setTimeout(finish, timeoutMs);
    });
  }
}
