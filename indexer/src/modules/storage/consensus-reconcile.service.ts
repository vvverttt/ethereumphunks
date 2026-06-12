import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { StorageService } from './storage.service';
import { chain } from '@/constants/ethereum';

const PROTOCOL_API = 'https://api.ethscriptions.com/v2/ethscriptions';

/**
 * Indexer-side consensus enforcement (Chopper's "same on the indexer side").
 *
 * Out-of-band reconciliation: every interval it cross-checks the *listed* items
 * against the canonical ethscriptions protocol indexer (api.ethscriptions.com).
 * If an item's real on-chain owner disagrees with ours, the listing is removed so
 * a divergent item can't be bought/sold from the market grid — the same thing the
 * item-page consensus check does, enforced server-side.
 *
 * Deliberately out-of-band (not in the block-processing path): a real-time check
 * would be racy (the protocol can lag us by a block and false-reject a valid fresh
 * listing). Running on an interval lets both indexers settle first. Fail-open: any
 * API error/timeout is skipped so an ethscriptions.com outage never wipes listings.
 */
@Injectable()
export class ConsensusReconcileService implements OnModuleInit {
  private readonly logger = new Logger('ConsensusReconcile');
  private readonly INTERVAL_MS = 20 * 60 * 1000; // 20 min
  private running = false;

  constructor(private readonly storage: StorageService) {}

  onModuleInit() {
    if (chain !== 'mainnet') return;
    if (!Number(process.env.QUEUE)) return; // only the active processing instance
    setTimeout(() => this.loop(), 90_000); // first run after warm-up
  }

  private async loop(): Promise<void> {
    for (;;) {
      try {
        await this.reconcile();
      } catch (e: any) {
        this.logger.error(`reconcile failed: ${e?.message || e}`);
      }
      await this.sleep(this.INTERVAL_MS);
    }
  }

  async reconcile(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const items = await this.storage.getActiveListingOwners();
      if (!items?.length) return;

      let removed = 0;
      for (const it of items) {
        const real = await this.protocolOwner(it.hashId);
        if (real === null) continue; // API error/unknown → fail-open, skip
        if (real !== (it.owner || '').toLowerCase()) {
          await this.storage.removeListing(it.hashId);
          removed++;
          this.logger.warn(
            `🚨 Consensus mismatch — removed listing ${it.hashId} (ours=${it.owner}, protocol=${real})`,
          );
        }
        await this.sleep(120); // pace the public API
      }
      if (removed) {
        this.logger.log(`Consensus reconcile: removed ${removed} divergent listing(s) of ${items.length} checked`);
      }
    } finally {
      this.running = false;
    }
  }

  private async protocolOwner(hashId: string): Promise<string | null> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${PROTOCOL_API}/${hashId}`, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'etherphunks-indexer' },
      });
      clearTimeout(t);
      if (!res.ok) return null;
      const d: any = await res.json();
      const owner = (d?.result?.current_owner || d?.current_owner || '').toLowerCase();
      return owner || null;
    } catch {
      return null; // network error/timeout → fail-open
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
