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

    const { request } = await publicClient.simulateContract({
      address: lotteryAddress,
      abi: PhilipLotteryV68ABI,
      functionName: 'play',
      account: walletClient.account.address,
      value: playPrice,
    });

    // Cheap gas: base fee + 0 tip (same pattern as writeMarketContract)
    const gas = await firstValueFrom(this.gasSvc.gas$);
    if (gas.ProposeGasPrice && gas.ProposeGasPrice !== '...' && gas.ProposeGasPrice !== 'err') {
      const base = parseGwei(gas.ProposeGasPrice);
      request.maxFeePerGas = base;
      request.maxPriorityFeePerGas = 0n;
    }

    // Estimate gas and add 20% buffer for accurate wallet display
    const estimatedGas = await publicClient.estimateContractGas({
      address: lotteryAddress,
      abi: PhilipLotteryV68ABI,
      functionName: 'play',
      account: walletClient.account.address,
      value: playPrice,
    });
    request.gas = estimatedGas * 120n / 100n;

    return await walletClient.writeContract(request);
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
}
