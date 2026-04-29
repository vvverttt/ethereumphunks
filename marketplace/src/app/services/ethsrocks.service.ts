import { Injectable } from '@angular/core';
import { encodeFunctionData, formatEther } from 'viem';
import { getWalletClient, getChainId, reconnect } from '@wagmi/core';

import { environment } from 'src/environments/environment';
import { Web3Service } from './web3.service';
import { EthsRocksABI } from '@/abi/EthsRocks';

const ethsrocksAddress = ((environment as any).ethsrocksAddress || '') as `0x${string}`;
const ethsrocksDeployBlock = ((environment as any).ethsrocksDeployBlock as bigint) || 0n;
const MAX_LOG_BLOCK_RANGE = 10n;

export interface RockPurchase {
  buyer: string;
  hashId: string;
  price: string;              // formatted ETH
  saleNumber: number;
  blockNumber: number;
}

export interface Commitment {
  commitBlock: bigint;
  priceLocked: bigint;
}

@Injectable({
  providedIn: 'root'
})
export class EthsRocksService {

  constructor(
    private web3Svc: Web3Service,
  ) {}

  get hasAddress(): boolean {
    return !!ethsrocksAddress && ethsrocksAddress !== '0x';
  }

  // ─── Contract Reads ─────────────────────────────────────

  async getCurrentPrice(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'currentPrice',
    });
  }

  async getPoolSize(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'poolSize',
    });
  }

  async getTotalRevealed(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'totalRevealed',
    });
  }

  async getPendingReveals(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'pendingReveals',
    });
  }

  async isPaused(): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'paused',
    });
  }

  async isBlocked(address: `0x${string}`): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'blocked',
      args: [address],
    });
  }

  async isAllowed(address: `0x${string}`): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'allowed',
      args: [address],
    });
  }

  async isAllowlistEnabled(): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'allowlistEnabled',
    });
  }

  async getTotalFreeClaimed(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'totalFreeClaimed',
    });
  }

  async getFreeClaims(address: `0x${string}`): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'freeClaims',
      args: [address],
    });
  }

  async getCommitment(address: `0x${string}`): Promise<Commitment> {
    const result = await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'commitments',
      args: [address],
    });
    const [commitBlock, priceLocked] = result as any;
    return { commitBlock, priceLocked };
  }

  async getContractState() {
    if (!this.hasAddress) return null;
    try {
      const [price, pool, sold, pending, paused, freeClaimed, swapEnabled, totalSwapped, v2Required, philipRequired] = await Promise.all([
        this.getCurrentPrice(),
        this.getPoolSize(),
        this.getTotalRevealed(),
        this.getPendingReveals(),
        this.isPaused(),
        this.getTotalFreeClaimed(),
        this.getSwapEnabled(),
        this.getTotalSwapped(),
        this.getCryptoPhunksV2Required(),
        this.getPhilipInternRequired(),
      ]);
      return {
        price,
        priceFormatted: formatEther(price),
        poolSize: Number(pool),
        totalSold: Number(sold),
        pendingReveals: Number(pending),
        paused,
        remaining: Number(pool) - Number(pending),
        totalFreeClaimed: Number(freeClaimed),
        swapEnabled,
        totalSwapped: Number(totalSwapped),
        cryptoPhunksV2Required: Number(v2Required) || 1,
        philipInternRequired: Number(philipRequired) || 3,
      };
    } catch {
      return null;
    }
  }

  // ─── Purchase History (RockPurchased events) ──────────

  async getPurchaseHistory(): Promise<RockPurchase[]> {
    if (!this.hasAddress) return [];
    try {
      const latestBlock = await this.web3Svc.l1Client.getBlockNumber();
      const logs: any[] = [];

      for (let from = ethsrocksDeployBlock; from <= latestBlock; from += MAX_LOG_BLOCK_RANGE) {
        const to = from + MAX_LOG_BLOCK_RANGE - 1n > latestBlock
          ? latestBlock
          : from + MAX_LOG_BLOCK_RANGE - 1n;

        const chunk = await this.web3Svc.l1Client.getContractEvents({
          address: ethsrocksAddress,
          abi: EthsRocksABI,
          eventName: 'RockPurchased',
          fromBlock: from,
          toBlock: to,
        });
        logs.push(...chunk);
      }

      return logs.map((log: any) => ({
        buyer: log.args.buyer,
        hashId: log.args.hashId,
        price: formatEther(log.args.price),
        saleNumber: Number(log.args.saleNumber),
        blockNumber: Number(log.blockNumber),
      }));
    } catch {
      return [];
    }
  }

  // ─── Wallet Client Helper ────────────────────────────

  private async getWallet() {
    try {
      const chainId = getChainId(this.web3Svc.config);
      return await getWalletClient(this.web3Svc.config, { chainId });
    } catch {
      await reconnect(this.web3Svc.config);
      const chainId = getChainId(this.web3Svc.config);
      return await getWalletClient(this.web3Svc.config, { chainId });
    }
  }

  // ─── Contract Writes — use sendTransaction to bypass Rainbow simulation ──

  async commit(maxPrice: bigint, value: bigint) {
    const walletClient = await this.getWallet();
    const data = encodeFunctionData({
      abi: EthsRocksABI,
      functionName: 'commit',
      args: [maxPrice],
    });
    return await walletClient.sendTransaction({
      to: ethsrocksAddress,
      data,
      value,
      gas: 200_000n,
    });
  }

  async reveal() {
    const walletClient = await this.getWallet();
    const data = encodeFunctionData({
      abi: EthsRocksABI,
      functionName: 'reveal',
    });
    return await walletClient.sendTransaction({
      to: ethsrocksAddress,
      data,
      gas: 300_000n,
    });
  }

  async cancelCommitment() {
    const walletClient = await this.getWallet();
    const data = encodeFunctionData({
      abi: EthsRocksABI,
      functionName: 'cancelCommitment',
    });
    return await walletClient.sendTransaction({
      to: ethsrocksAddress,
      data,
      gas: 150_000n,
    });
  }

  async freeClaim() {
    const walletClient = await this.getWallet();
    const data = encodeFunctionData({
      abi: EthsRocksABI,
      functionName: 'freeClaim',
    });
    return await walletClient.sendTransaction({
      to: ethsrocksAddress,
      data,
      gas: 300_000n,
    });
  }

  async getSwapEnabled(): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'swapEnabled',
    });
  }

  async getTotalSwapped(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'totalSwapped',
    });
  }

  async isDepositedBy(address: `0x${string}`, hashId: `0x${string}`): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'userEthscriptionPossiblyStored',
      args: [address, hashId],
    });
  }

  async isEligibleEthscription(hashId: `0x${string}`): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'eligibleEthscription',
      args: [hashId],
    });
  }

  async getCryptoPhunksV2Required(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'cryptoPhunksV2Required',
    });
  }

  async getEthscriptionBatchRequired(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'ethscriptionBatchRequired',
    });
  }

  async isEligibleEthscriptionBatch(hashId: `0x${string}`): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'eligibleEthscriptionBatch',
      args: [hashId],
    });
  }

  async getPhilipInternRequired(): Promise<bigint> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'philipInternRequired',
    });
  }

  // ─── Swap Writes ─────────────────────────────────────

  async swapCryptoPhunksV2(tokenIds: bigint[]) {
    const walletClient = await this.getWallet();
    const data = encodeFunctionData({
      abi: EthsRocksABI,
      functionName: 'swapCryptoPhunksV2',
      args: [tokenIds],
    });
    return await walletClient.sendTransaction({
      to: ethsrocksAddress,
      data,
      gas: 400_000n,
    });
  }

  async swapPhilipIntern(tokenIds: bigint[]) {
    const walletClient = await this.getWallet();
    const data = encodeFunctionData({
      abi: EthsRocksABI,
      functionName: 'swapPhilipIntern',
      args: [tokenIds],
    });
    return await walletClient.sendTransaction({
      to: ethsrocksAddress,
      data,
      gas: 500_000n,
    });
  }

  async swapEthscription(hashId: `0x${string}`) {
    const walletClient = await this.getWallet();
    const data = encodeFunctionData({
      abi: EthsRocksABI,
      functionName: 'swapEthscription',
      args: [hashId],
    });
    return await walletClient.sendTransaction({
      to: ethsrocksAddress,
      data,
      gas: 400_000n,
    });
  }

  async depositEthscriptionForSwap(hashId: `0x${string}`) {
    const walletClient = await this.getWallet();
    return await walletClient.sendTransaction({
      to: ethsrocksAddress,
      data: hashId as `0x${string}`,
      gas: 100_000n,
    });
  }

  async depositEthscriptionBatchForSwap(hashIds: `0x${string}`[]) {
    const walletClient = await this.getWallet();
    // Concatenate all hashIds as calldata (32 bytes each, no 0x prefix after first)
    const data = ('0x' + hashIds.map(h => h.slice(2)).join('')) as `0x${string}`;
    return await walletClient.sendTransaction({
      to: ethsrocksAddress,
      data,
      gas: BigInt(60_000 + hashIds.length * 30_000),
    });
  }

  async swapEthscriptionBatch(hashIds: `0x${string}`[], proofs: `0x${string}`[][]) {
    const walletClient = await this.getWallet();
    const data = encodeFunctionData({
      abi: EthsRocksABI,
      functionName: 'swapEthscriptionBatch',
      args: [hashIds, proofs],
    });
    return await walletClient.sendTransaction({
      to: ethsrocksAddress,
      data,
      gas: 600_000n,
    });
  }

  async withdraw() {
    const walletClient = await this.getWallet();
    const data = encodeFunctionData({
      abi: EthsRocksABI,
      functionName: 'withdraw',
    });
    return await walletClient.sendTransaction({
      to: ethsrocksAddress,
      data,
    });
  }
}
