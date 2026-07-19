import { Injectable } from '@angular/core';

interface WhitelistPayload {
  root: string;
  generatedAt: string;
  count: number;
  proofs: Record<string, string[]>;
}

/**
 * Resolves a wallet's merkle proof for the auction-house buy-now whitelist (OG Missing Phunks +
 * OG DystoPhunks holders, escrow-resolved). Filename is legacy ("phikings"); content is regenerated.
 *
 * The bundled snapshot is a CONVENIENCE, not a permission: the contract verifies the proof against
 * its own buyNowMerkleRoot on every call. If the owner rotates the root via setBuyNow(), this file
 * goes stale and proofs stop verifying — hence `matchesRoot()`, so the UI can hide buy-now rather
 * than hand users a transaction that is guaranteed to revert.
 */
@Injectable({ providedIn: 'root' })
export class BuyNowWhitelistService {

  private payload: WhitelistPayload | null = null;
  private loading: Promise<WhitelistPayload | null> | null = null;

  private async load(): Promise<WhitelistPayload | null> {
    if (this.payload) return this.payload;
    if (this.loading) return this.loading;

    this.loading = fetch('assets/phikings-buynow-whitelist.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (this.payload = j))
      .catch(() => null);

    return this.loading;
  }

  /** Proof for `address`, or null when the wallet isn't in the snapshot. */
  async proofFor(address: string | null | undefined): Promise<string[] | null> {
    if (!address) return null;
    const wl = await this.load();
    return wl?.proofs?.[address.toLowerCase()] ?? null;
  }

  /** The snapshot's root — compare against the contract's before trusting any proof. */
  async snapshotRoot(): Promise<string | null> {
    return (await this.load())?.root ?? null;
  }

  /** False when the on-chain root has moved on from this bundle (stale snapshot). */
  async matchesRoot(onChainRoot: string | null | undefined): Promise<boolean> {
    if (!onChainRoot) return false;
    const root = await this.snapshotRoot();
    return !!root && root.toLowerCase() === onChainRoot.toLowerCase();
  }
}
