import { Injectable } from '@angular/core';
import { formatEther } from 'viem';
import { getWalletClient } from '@wagmi/core';

import { environment } from 'src/environments/environment';
import { Web3Service } from './web3.service';
import { EthsRocksABI } from '@/abi/EthsRocks';

const ethsrocksAddress = ((environment as any).ethsrocksAddress || '') as `0x${string}`;

export interface Commitment {
  commitBlock: bigint;
  priceLocked: bigint;
  missingPhunkHash: string;
  quantumDystoHash: string;
  quantumPhunkHash: string;
  nftContract: string;
  philipOrWrappedId: bigint;
  cryptoPhunksV2Id: bigint;
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

  async getCommitment(address: `0x${string}`): Promise<Commitment> {
    const result = await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'commitments',
      args: [address],
    });
    const [commitBlock, priceLocked, missingPhunkHash, quantumDystoHash, quantumPhunkHash, nftContract, philipOrWrappedId, cryptoPhunksV2Id] = result as any;
    return { commitBlock, priceLocked, missingPhunkHash, quantumDystoHash, quantumPhunkHash, nftContract, philipOrWrappedId, cryptoPhunksV2Id };
  }

  async getContractState() {
    if (!this.hasAddress) return null;
    try {
      const [price, pool, sold, pending, paused] = await Promise.all([
        this.getCurrentPrice(),
        this.getPoolSize(),
        this.getTotalRevealed(),
        this.getPendingReveals(),
        this.isPaused(),
      ]);
      return {
        price,
        priceFormatted: formatEther(price),
        poolSize: Number(pool),
        totalSold: Number(sold),
        pendingReveals: Number(pending),
        paused,
        remaining: Number(pool) - Number(pending),
      };
    } catch {
      return null;
    }
  }

  // ─── ERC-721 Helpers ───────────────────────────────────

  async getNftAddresses(): Promise<{
    philipIntern: `0x${string}`;
    wrappedV1: `0x${string}`;
    cryptoPhunksV2: `0x${string}`;
  }> {
    const [philipIntern, wrappedV1, cryptoPhunksV2] = await Promise.all([
      this.web3Svc.l1Client.readContract({
        address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'philipInternAddress',
      }),
      this.web3Svc.l1Client.readContract({
        address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'wrappedV1Address',
      }),
      this.web3Svc.l1Client.readContract({
        address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'cryptoPhunksV2Address',
      }),
    ]);
    return {
      philipIntern: philipIntern as `0x${string}`,
      wrappedV1: wrappedV1 as `0x${string}`,
      cryptoPhunksV2: cryptoPhunksV2 as `0x${string}`,
    };
  }

  async checkERC721Owner(nftContract: `0x${string}`, tokenId: bigint): Promise<`0x${string}`> {
    const ownerOfAbi = [{
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      name: 'ownerOf',
      outputs: [{ name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function',
    }] as const;
    return await this.web3Svc.l1Client.readContract({
      address: nftContract, abi: ownerOfAbi, functionName: 'ownerOf', args: [tokenId],
    }) as `0x${string}`;
  }

  async isERC721Used(nftContract: `0x${string}`, tokenId: bigint): Promise<boolean> {
    return await this.web3Svc.l1Client.readContract({
      address: ethsrocksAddress, abi: EthsRocksABI, functionName: 'usedERC721', args: [nftContract, tokenId],
    }) as boolean;
  }

  // ─── Authorization (backend signer) ─────────────────────

  async getAuthorization(address: string): Promise<{
    eligible: boolean;
    reason?: string;
    signature?: string;
    missingPhunkHash?: string;
    quantumDystoHash?: string;
    quantumPhunkHash?: string;
    deadline?: number;
  }> {
    const res = await fetch(`${environment.relayUrl}/ethsrocks/authorize/${address}`);
    return await res.json();
  }

  // ─── Contract Writes ────────────────────────────────────

  async commit(args: {
    signature: `0x${string}`;
    deadline: bigint;
    maxPrice: bigint;
    missingPhunkHash: `0x${string}`;
    quantumDystoHash: `0x${string}`;
    quantumPhunkHash: `0x${string}`;
    philipOrWrappedTokenId: bigint;
    usePhilipIntern: boolean;
    cryptoPhunksV2TokenId: bigint;
    value: bigint;
  }) {
    const walletClient = await getWalletClient(this.web3Svc.config);
    return await walletClient.writeContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'commit',
      args: [
        args.signature,
        args.deadline,
        args.maxPrice,
        args.missingPhunkHash,
        args.quantumDystoHash,
        args.quantumPhunkHash,
        args.philipOrWrappedTokenId,
        args.usePhilipIntern,
        args.cryptoPhunksV2TokenId,
      ],
      value: args.value,
    });
  }

  async reveal() {
    const walletClient = await getWalletClient(this.web3Svc.config);
    return await walletClient.writeContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'reveal',
    });
  }

  async cancelCommitment() {
    const walletClient = await getWalletClient(this.web3Svc.config);
    return await walletClient.writeContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'cancelCommitment',
    });
  }

  async withdraw() {
    const walletClient = await getWalletClient(this.web3Svc.config);
    return await walletClient.writeContract({
      address: ethsrocksAddress,
      abi: EthsRocksABI,
      functionName: 'withdraw',
    });
  }
}
