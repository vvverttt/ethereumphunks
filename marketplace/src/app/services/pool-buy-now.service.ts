import { Injectable } from '@angular/core';
import { getWalletClient, reconnect } from '@wagmi/core';

import { environment } from 'src/environments/environment';
import { Web3Service } from './web3.service';
import { BuyNowWhitelistService } from './buy-now-whitelist.service';
import { EtherPhunksAuctionHouseV2ABI } from '@/abi/EtherPhunksAuctionHouseV2';

const AUCTION_ADDRESS = (environment as any).auctionAddress as `0x${string}`;

/**
 * Per-item buy-now tier. LOWEST price wins for a wallet eligible for more than one:
 *   2 = EthsRocks     (0.167, buyNow2 whitelist)
 *   1 = Missing/Dysto (0.267, buyNow  whitelist)
 *   0 = PUBLIC        (0.367, no whitelist — anyone)
 */
export type BuyItemTier = 0 | 1 | 2;

export interface PoolBuyNowConfig {
  /** Master switch for the whole per-item buy-now feature. */
  itemEnabled: boolean;
  publicEnabled: boolean;
  publicPrice: bigint;
  tier1Enabled: boolean;   // Missing/Dysto (buyNow)
  tier1Price: bigint;
  tier1Root: string;
  tier2Enabled: boolean;   // EthsRocks (buyNow2)
  tier2Price: bigint;
  tier2Root: string;
}

export interface ResolvedTier {
  tier: BuyItemTier;
  priceWei: bigint;
  proof: string[];
}

/**
 * Reads the auction house's per-item buy-now config and drives {buyItem} for pool items shown on the
 * item details page. The contract re-verifies enabled/price/proof/inPool on every buy, so everything
 * here is convenience: it only decides which button to show and the exact value to send.
 */
@Injectable({ providedIn: 'root' })
export class PoolBuyNowService {

  constructor(
    private web3Svc: Web3Service,
    private wl: BuyNowWhitelistService,
  ) {}

  /** Is this ethscription currently a buyable pool item (not the live auction item)? */
  async isInPool(hashId: string): Promise<boolean> {
    try {
      return await this.web3Svc.l1DedicatedClient.readContract({
        address: AUCTION_ADDRESS,
        abi: EtherPhunksAuctionHouseV2ABI,
        functionName: 'inPool',
        args: [hashId as `0x${string}`],
      }) as boolean;
    } catch {
      return false;
    }
  }

  /**
   * Full on-chain config for the three tiers + master switch. A pre-V5 implementation simply lacks
   * the V5 selectors — allowFailure treats those as off, so the UI degrades to "no buy-now" instead
   * of throwing. Hard 8s timeout so a flaky gateway can never wedge the details page.
   */
  async getConfig(): Promise<PoolBuyNowConfig> {
    const OFF: PoolBuyNowConfig = {
      itemEnabled: false,
      publicEnabled: false, publicPrice: 0n,
      tier1Enabled: false, tier1Price: 0n, tier1Root: '0x',
      tier2Enabled: false, tier2Price: 0n, tier2Root: '0x',
    };
    const read = (async (): Promise<PoolBuyNowConfig> => {
      const r = await (this.web3Svc.l1DedicatedClient as any).multicall({
        contracts: [
          { address: AUCTION_ADDRESS, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'itemBuyNowEnabled' },
          { address: AUCTION_ADDRESS, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'buyNowPublicEnabled' },
          { address: AUCTION_ADDRESS, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'buyNowPublicPrice' },
          { address: AUCTION_ADDRESS, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'buyNowEnabled' },
          { address: AUCTION_ADDRESS, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'buyNowPrice' },
          { address: AUCTION_ADDRESS, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'buyNowMerkleRoot' },
          { address: AUCTION_ADDRESS, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'buyNow2Enabled' },
          { address: AUCTION_ADDRESS, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'buyNow2Price' },
          { address: AUCTION_ADDRESS, abi: EtherPhunksAuctionHouseV2ABI, functionName: 'buyNow2MerkleRoot' },
        ],
        allowFailure: true,
      });
      return {
        itemEnabled: (r[0]?.result as boolean) ?? false,
        publicEnabled: (r[1]?.result as boolean) ?? false,
        publicPrice: (r[2]?.result as bigint) ?? 0n,
        tier1Enabled: (r[3]?.result as boolean) ?? false,
        tier1Price: (r[4]?.result as bigint) ?? 0n,
        tier1Root: (r[5]?.result as string) ?? '0x',
        tier2Enabled: (r[6]?.result as boolean) ?? false,
        tier2Price: (r[7]?.result as bigint) ?? 0n,
        tier2Root: (r[8]?.result as string) ?? '0x',
      };
    })();
    const timeout = new Promise<PoolBuyNowConfig>((res) => setTimeout(() => res(OFF), 8000));
    try { return await Promise.race([read, timeout]); } catch { return OFF; }
  }

  /**
   * The single tier a wallet should buy at: the LOWEST-priced tier it's eligible for. EthsRocks
   * (0.167) beats Missing/Dysto (0.267) beats PUBLIC (0.367). Returns null only when the feature is
   * off or the wallet has no eligible tier (e.g. public tier disabled and not whitelisted).
   */
  async resolveTier(address: string | null | undefined, config: PoolBuyNowConfig): Promise<ResolvedTier | null> {
    if (!config.itemEnabled) return null;

    // Collect every tier the wallet is eligible for, then return the genuinely CHEAPEST — compare by
    // price, not tier number, so a lower-priced tier always wins even if it isn't tier 2. (Only resolve
    // proofs for tiers whose bundled snapshot still matches the live root — a stale bundle would hand
    // out a guaranteed-revert proof.)
    const candidates: ResolvedTier[] = [];
    if (address && config.tier2Enabled && config.tier2Price > 0n && await this.wl.matchesRoot(2, config.tier2Root)) {
      const proof = await this.wl.proofFor(2, address);
      if (proof) candidates.push({ tier: 2, priceWei: config.tier2Price, proof });
    }
    if (address && config.tier1Enabled && config.tier1Price > 0n && await this.wl.matchesRoot(1, config.tier1Root)) {
      const proof = await this.wl.proofFor(1, address);
      if (proof) candidates.push({ tier: 1, priceWei: config.tier1Price, proof });
    }
    if (config.publicEnabled && config.publicPrice > 0n) {
      candidates.push({ tier: 0, priceWei: config.publicPrice, proof: [] });
    }
    if (!candidates.length) return null;
    return candidates.reduce((lo, c) => (c.priceWei < lo.priceWei ? c : lo));
  }

  /** Send the buyItem tx. `priceWei` must be the live on-chain tier price (read just before). */
  async buyItem(hashId: string, tier: BuyItemTier, proof: string[], priceWei: bigint): Promise<string | undefined> {
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

    return await walletClient.writeContract({
      address: AUCTION_ADDRESS,
      abi: EtherPhunksAuctionHouseV2ABI,
      functionName: 'buyItem',
      args: [hashId as `0x${string}`, tier, proof as `0x${string}`[]],
      value: priceWei,
      chain: walletClient.chain,
      account: walletClient.account,
    });
  }
}
