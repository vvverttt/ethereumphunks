import { Injectable } from '@angular/core';
import { decodeFunctionData, formatEther } from 'viem';
import { getWalletClient } from '@wagmi/core';

import { environment } from 'src/environments/environment';
import { Web3Service } from './web3.service';
import { EthsRocksABI } from '@/abi/EthsRocks';

const ethsrocksAddress = ((environment as any).ethsrocksAddress || '') as `0x${string}`;
const ethsrocksDeployBlock = ((environment as any).ethsrocksDeployBlock as bigint) || 0n;

export interface UsedPurchase {
  buyer: string;
  missingPhunkHash: string;
  quantumDystoHash: string;
  quantumPhunkHash: string;
  nftLabel: string;           // "PhilipIntern" or "Wrapped V1"
  philipOrWrappedTokenId: string;
  cryptoPhunksV2TokenId: string;
  price: string;              // formatted ETH
  blockNumber: number;
}

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

  // ─── ERC-721 Enumeration ─────────────────────────────────

  private readonly enumerableAbi = [
    {
      inputs: [{ name: 'owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }],
      name: 'tokenOfOwnerByIndex',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  async getOwnedTokenIds(nftContract: `0x${string}`, owner: `0x${string}`): Promise<bigint[]> {
    try {
      const balance = await this.web3Svc.l1Client.readContract({
        address: nftContract, abi: this.enumerableAbi, functionName: 'balanceOf', args: [owner],
      });
      const count = Number(balance);
      if (count === 0) return [];

      const ids: bigint[] = [];
      for (let i = 0; i < count; i++) {
        const tokenId = await this.web3Svc.l1Client.readContract({
          address: nftContract, abi: this.enumerableAbi, functionName: 'tokenOfOwnerByIndex', args: [owner, BigInt(i)],
        });
        ids.push(tokenId as bigint);
      }
      return ids;
    } catch {
      return [];
    }
  }

  async getAvailableTokens(nftContract: `0x${string}`, owner: `0x${string}`): Promise<bigint[]> {
    const owned = await this.getOwnedTokenIds(nftContract, owner);
    if (owned.length === 0) return [];

    const usedChecks = await Promise.all(
      owned.map(id => this.isERC721Used(nftContract, id))
    );
    return owned.filter((_, i) => !usedChecks[i]);
  }

  // ─── Purchase History (event logs + tx decode) ──────────

  async getPurchaseHistory(): Promise<UsedPurchase[]> {
    if (!this.hasAddress) return [];
    try {
      // Get all RockCommitted events
      const logs = await this.web3Svc.l1Client.getContractEvents({
        address: ethsrocksAddress,
        abi: EthsRocksABI,
        eventName: 'RockCommitted',
        fromBlock: ethsrocksDeployBlock,
      });

      // For each event, decode the commit tx input to get token details
      const purchases: UsedPurchase[] = [];
      for (const log of logs) {
        try {
          const tx = await this.web3Svc.l1Client.getTransaction({ hash: log.transactionHash! });
          const { args } = decodeFunctionData({ abi: EthsRocksABI, data: tx.input });
          const [, , , missingPhunkHash, quantumDystoHash, quantumPhunkHash, philipOrWrappedTokenId, usePhilipIntern, cryptoPhunksV2TokenId] = args as any;

          // Check if this commit is still active (not cancelled)
          const isUsed = await this.web3Svc.l1Client.readContract({
            address: ethsrocksAddress, abi: EthsRocksABI,
            functionName: 'usedEthscription', args: [missingPhunkHash],
          });
          if (!isUsed) continue; // Was cancelled — tokens released

          const isPhilip = usePhilipIntern as boolean;
          purchases.push({
            buyer: (log as any).args.buyer,
            missingPhunkHash: missingPhunkHash as string,
            quantumDystoHash: quantumDystoHash as string,
            quantumPhunkHash: quantumPhunkHash as string,
            nftLabel: isPhilip ? 'PhilipIntern' : 'Wrapped V1',
            philipOrWrappedTokenId: String(philipOrWrappedTokenId),
            cryptoPhunksV2TokenId: String(cryptoPhunksV2TokenId),
            price: formatEther((log as any).args.price),
            blockNumber: Number(log.blockNumber),
          });
        } catch {
          // Skip malformed entries
        }
      }
      return purchases;
    } catch {
      return [];
    }
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
