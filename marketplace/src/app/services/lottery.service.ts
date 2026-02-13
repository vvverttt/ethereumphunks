import { inject, Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { Observable, from, merge, map, switchMap, firstValueFrom } from 'rxjs';
import { formatEther, parseGwei } from 'viem';
import { getPublicClient, getWalletClient, getChainId } from '@wagmi/core';

import { environment } from 'src/environments/environment';
import { Web3Service } from './web3.service';
import { GasService } from './gas.service';
import { PhilipLotteryV68ABI } from '@/abi/PhilipLotteryV68';
import { LotteryWin } from '@/models/lottery';

const supabaseUrl = environment.supabaseUrl;
const supabaseKey = environment.supabaseKey;
const supabase = createClient(supabaseUrl, supabaseKey);
const suffix = environment.chainId === 1 ? '' : '_sepolia';
const lotteryAddress = (environment as any).lotteryAddress as `0x${string}`;

@Injectable({
  providedIn: 'root'
})
export class LotteryService {

  private gasSvc = inject(GasService);

  constructor(
    private web3Svc: Web3Service,
  ) {}

  // =========================================================
  // Contract Reads
  // =========================================================

  async getPlayPrice(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: lotteryAddress,
      abi: PhilipLotteryV68ABI,
      functionName: 'playPrice',
    });
  }

  async getPlayPriceFormatted(): Promise<string> {
    const price = await this.getPlayPrice();
    return formatEther(price);
  }

  async isActive(): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: lotteryAddress,
      abi: PhilipLotteryV68ABI,
      functionName: 'active',
    });
  }

  async getPoolSize(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: lotteryAddress,
      abi: PhilipLotteryV68ABI,
      functionName: 'poolSize',
    });
  }

  async getPoolItems(offset: number, limit: number): Promise<string[]> {
    const result = await this.web3Svc.l1Client.readContract({
      address: lotteryAddress,
      abi: PhilipLotteryV68ABI,
      functionName: 'getPoolItems',
      args: [BigInt(offset), BigInt(limit)],
    });
    return result as string[];
  }

  async getContractBalance(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: lotteryAddress,
      abi: PhilipLotteryV68ABI,
      functionName: 'getBalance',
    });
  }

  async getOwner(): Promise<string> {
    return await this.web3Svc.l1Client.readContract({
      address: lotteryAddress,
      abi: PhilipLotteryV68ABI,
      functionName: 'owner',
    });
  }

  // =========================================================
  // Contract Writes
  // =========================================================

  async play(): Promise<string | undefined> {
    await this.web3Svc.switchNetwork();

    // After switchNetwork('l1') we're guaranteed on the target chain
    const chainId = environment.chainId;
    const walletClient = await getWalletClient(this.web3Svc.config, { chainId });
    const publicClient = getPublicClient(this.web3Svc.config, { chainId });

    if (!walletClient) throw new Error('No wallet connected');
    if (!publicClient) throw new Error('No public client');

    const playPrice = await this.getPlayPrice();

    // Let the wallet handle everything — no gas overrides
    console.time('[Lottery] writeContract');
    const hash = await walletClient.writeContract({
      address: lotteryAddress,
      abi: PhilipLotteryV68ABI,
      functionName: 'play',
      value: playPrice,
      chain: walletClient.chain,
      account: walletClient.account,
    });
    console.timeEnd('[Lottery] writeContract');
    console.log('[Lottery] tx hash:', hash);
    return hash;
  }

  async withdrawETH(amount: bigint, to: string): Promise<string | undefined> {
    await this.web3Svc.switchNetwork();

    const chainId = getChainId(this.web3Svc.config);
    const walletClient = await getWalletClient(this.web3Svc.config, { chainId });
    const publicClient = getPublicClient(this.web3Svc.config, { chainId });

    if (!walletClient) throw new Error('No wallet connected');
    if (!publicClient) throw new Error('No public client');

    const { request } = await publicClient.simulateContract({
      address: lotteryAddress,
      abi: PhilipLotteryV68ABI,
      functionName: 'withdrawETH',
      args: [amount, to as `0x${string}`],
      account: walletClient.account.address,
    });

    return await walletClient.writeContract(request);
  }

  async depositPrizes(hashIds: string[]): Promise<string | undefined> {
    await this.web3Svc.switchNetwork();

    const chainId = getChainId(this.web3Svc.config);
    const walletClient = await getWalletClient(this.web3Svc.config, { chainId });

    if (!walletClient) throw new Error('No wallet connected');

    // Concatenate hashIds as calldata (each is 32 bytes)
    const data = ('0x' + hashIds.map(h => h.replace('0x', '').padStart(64, '0')).join('')) as `0x${string}`;

    return await walletClient.sendTransaction({
      to: lotteryAddress,
      data,
      account: walletClient.account,
      chain: walletClient.chain,
    });
  }

  // =========================================================
  // Supabase Queries
  // =========================================================

  fetchAllWins(): Observable<LotteryWin[]> {
    const query$ = from(
      supabase
        .from('lottery_wins' + suffix)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)
    ).pipe(map(r => (r.data || []) as LotteryWin[]));

    const changes$ = new Observable<void>(subscriber => {
      const channel = supabase
        .channel('lottery_all_wins_changes')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'lottery_wins' + suffix
        }, () => subscriber.next())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    });

    return merge(
      query$,
      changes$.pipe(switchMap(() => query$))
    );
  }

  fetchRecentWins(): Observable<LotteryWin[]> {
    const query$ = from(
      supabase
        .from('lottery_wins' + suffix)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
    ).pipe(map(r => (r.data || []) as LotteryWin[]));

    const changes$ = new Observable<void>(subscriber => {
      const channel = supabase
        .channel('lottery_wins_changes')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'lottery_wins' + suffix
        }, () => subscriber.next())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    });

    return merge(
      query$,
      changes$.pipe(switchMap(() => query$))
    );
  }

  watchForWin(playId: number): Observable<LotteryWin> {
    return new Observable(subscriber => {
      const channel = supabase
        .channel(`lottery_win_${playId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'lottery_wins' + suffix,
          filter: `play_id=eq.${playId}`
        }, (payload: any) => {
          subscriber.next(payload.new as LotteryWin);
          subscriber.complete();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    });
  }

  /**
   * Watch for a win by tx hash — races Supabase realtime + polling
   */
  watchForWinByTxHash(txHash: string): Promise<LotteryWin> {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (win: LotteryWin) => {
        if (resolved) return;
        resolved = true;
        supabase.removeChannel(channel);
        clearInterval(pollTimer);
        resolve(win);
      };

      // Realtime: listen for any INSERT on lottery_wins
      const channel = supabase
        .channel(`lottery_win_tx_${txHash.slice(0, 10)}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'lottery_wins' + suffix,
        }, (payload: any) => {
          const row = payload.new as LotteryWin;
          if (row.tx_hash?.toLowerCase() === txHash.toLowerCase()) {
            done(row);
          }
        })
        .subscribe();

      // Polling fallback: query every 3s in case realtime misses it
      const pollTimer = setInterval(async () => {
        const { data } = await supabase
          .from('lottery_wins' + suffix)
          .select('*')
          .eq('tx_hash', txHash.toLowerCase())
          .limit(1);
        if (data && data.length > 0) {
          done(data[0] as LotteryWin);
        }
      }, 3000);
    });
  }

  /**
   * Look up ethscription details by hashId to get the image
   */

  async getOwnedEthscriptions(address: string): Promise<{ hashId: string; sha: string; tokenId: number; slug: string }[]> {
    const { data } = await supabase
      .from('ethscriptions' + suffix)
      .select('hashId, sha, tokenId, slug')
      .eq('owner', address.toLowerCase())
      .not('sha', 'is', null)
      .order('tokenId', { ascending: true })
      .limit(500);
    return data || [];
  }

  async getEthscriptionsByHashIds(hashIds: string[]): Promise<any[]> {
    const { data } = await supabase
      .from('ethscriptions' + suffix)
      .select('hashId, sha, tokenId, slug')
      .in('hashId', hashIds);
    return data || [];
  }

  async getRandomPoolItems(count: number): Promise<any[]> {
    // Demo: always query mainnet ethscriptions table (has actual collection data)
    const { data } = await supabase
      .from('ethscriptions')
      .select('hashId, sha, tokenId, slug')
      .not('sha', 'is', null)
      .not('sha', 'eq', '')
      .limit(count);
    return data || [];
  }

  async getEthscriptionByTokenId(tokenId: number): Promise<{ hashId: string; sha: string; tokenId: number; slug: string } | null> {
    const { data } = await supabase
      .from('ethscriptions' + suffix)
      .select('hashId, sha, tokenId, slug')
      .eq('tokenId', tokenId)
      .limit(1);
    return data?.[0] || null;
  }

  fetchTotalWinsCount(): Observable<number> {
    return from(
      supabase
        .from('lottery_wins' + suffix)
        .select('*', { count: 'exact', head: true })
    ).pipe(map(r => r.count ?? 0));
  }
}
