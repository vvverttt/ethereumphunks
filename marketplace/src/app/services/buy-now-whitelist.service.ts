import { Injectable } from '@angular/core';

interface WhitelistPayload {
  root: string;
  generatedAt: string;
  count: number;
  proofs: Record<string, string[]>;
}

/** Buy-now tiers: 1 = Missing/Dysto holders (0.267, buyNow), 2 = EthsRocks holders (0.167, buyNow2). */
export type BuyNowTier = 1 | 2;

/**
 * Resolves a wallet's merkle proof for the auction-house buy-now whitelists. Two independent tiers,
 * each with its own bundled snapshot and on-chain root/price. The snapshots are a CONVENIENCE — the
 * contract re-verifies every proof against its own root — so `matchesRoot()` lets the UI hide a tier
 * whose bundle has gone stale rather than hand out a guaranteed-revert transaction.
 */
@Injectable({ providedIn: 'root' })
export class BuyNowWhitelistService {

  private readonly files: Record<BuyNowTier, string> = {
    1: 'assets/phikings-buynow-whitelist.json',     // Missing/Dysto (legacy filename)
    2: 'assets/buynow-ethsrocks-whitelist.json',    // EthsRocks
  };
  private payloads: Partial<Record<BuyNowTier, WhitelistPayload | null>> = {};
  private loading: Partial<Record<BuyNowTier, Promise<WhitelistPayload | null>>> = {};

  private async load(tier: BuyNowTier): Promise<WhitelistPayload | null> {
    if (this.payloads[tier]) return this.payloads[tier]!;
    if (this.loading[tier]) return this.loading[tier]!;
    this.loading[tier] = fetch(this.files[tier])
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (this.payloads[tier] = j))
      .catch(() => null);
    return this.loading[tier]!;
  }

  /** Proof for `address` in `tier`, or null when the wallet isn't in that snapshot. */
  async proofFor(tier: BuyNowTier, address: string | null | undefined): Promise<string[] | null> {
    if (!address) return null;
    const wl = await this.load(tier);
    return wl?.proofs?.[address.toLowerCase()] ?? null;
  }

  /** The tier's snapshot root — compare against the contract's before trusting any proof. */
  async snapshotRoot(tier: BuyNowTier): Promise<string | null> {
    return (await this.load(tier))?.root ?? null;
  }

  /** False when the on-chain root for this tier has moved on from the bundle (stale snapshot). */
  async matchesRoot(tier: BuyNowTier, onChainRoot: string | null | undefined): Promise<boolean> {
    if (!onChainRoot) return false;
    const root = await this.snapshotRoot(tier);
    return !!root && root.toLowerCase() === onChainRoot.toLowerCase();
  }
}
