import { Component, OnDestroy, OnInit, inject, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { formatEther } from 'viem';
import { firstValueFrom } from 'rxjs';
import { Store } from '@ngrx/store';

import { AuctionService, AuctionData, AuctionBidEvent } from '@/services/auction.service';
import { Web3Service } from '@/services/web3.service';
import { SpriteService } from '@/services/sprite.service';
import { TimerComponent } from '@/components/auction/timer/timer.component';

import { GlobalState } from '@/models/global-state';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';

/**
 * The live auction, inline in a collection page's splash band.
 *
 * The /auction page is the full house — history, pool, buy-now, settle. This is the
 * one thing a visitor on the collection page actually wants: what is up right now,
 * what it stands at, how long is left, and a box to bid in without leaving.
 *
 * It renders ONLY when the live auction's item belongs to `slug`, so the strip can sit
 * on any collection page and simply stay invisible when that collection is not the one
 * currently under the hammer.
 *
 * Bidding goes through AuctionService.createBid — the identical call the auction page
 * makes — so there is one contract path to reason about, not two.
 */
@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TimerComponent],
  // AuctionService is deliberately NOT providedIn:'root' — the auction page supplies its
  // own instance. Without this the injector has nothing to resolve, inject() throws during
  // construction, and the failure takes the whole collection page down with it.
  providers: [AuctionService],
  selector: 'app-auction-strip',
  templateUrl: './auction-strip.component.html',
  styleUrls: ['./auction-strip.component.scss'],
})
export class AuctionStripComponent implements OnInit, OnDestroy {

  /** Only show while the live item belongs to this collection. */
  slug = input.required<string>();

  private readonly auctionSvc = inject(AuctionService);
  private readonly spriteSvc = inject(SpriteService);
  private readonly store = inject(Store<GlobalState>);
  readonly web3Svc = inject(Web3Service);

  readonly connected$ = this.store.select(appStateSelectors.selectConnected);

  auction = signal<AuctionData | null>(null);
  image = signal<string>('');
  tokenId = signal<number>(0);
  itemSlug = signal<string>('');
  minIncrement = signal<number>(10);
  reserveEth = signal<string>('0');

  bid = signal<string>('');
  pending = signal<boolean>(false);
  error = signal<string>('');
  txHash = signal<string>('');
  ended = signal<boolean>(false);

  bids = signal<AuctionBidEvent[]>([]);
  bidsOpen = signal<boolean>(false);

  private poll: any;

  /** The strip is for THIS collection's live item only. */
  visible = computed<boolean>(() => {
    const a = this.auction();
    return !!a && !a.settled && a.startTime > 0 && this.itemSlug() === this.slug();
  });

  currentEth = computed<string>(() => {
    const a = this.auction();
    return a && a.amount > 0n ? formatEther(a.amount) : '';
  });

  hasBids = computed<boolean>(() => {
    const a = this.auction();
    return !!a && a.amount > 0n;
  });

  /**
   * What the contract will actually accept next: the reserve while nobody has bid,
   * otherwise the standing bid plus the minimum increment. Rounded UP at 6 decimals —
   * rounding down would produce a number the contract rejects, which is the whole
   * reason this is computed rather than guessed at in the template.
   */
  minNextEth = computed<string>(() => {
    const a = this.auction();
    if (!a || a.amount === 0n) return this.reserveEth();
    const next = (a.amount * BigInt(100 + this.minIncrement()) + 99n) / 100n;
    return formatEther(next);
  });

  endTimeMs = computed<number>(() => (this.auction()?.endTime ?? 0) * 1000);

  async ngOnInit() {
    await this.load();
    // The auction page owns the heavy refresh; here a slow poll is enough to keep the
    // price honest without adding RPC load to every collection-page visit.
    this.poll = setInterval(() => this.load(), 30_000);
  }

  ngOnDestroy() {
    clearInterval(this.poll);
  }

  /**
   * The shared timer emits `{left}` every second, not a one-shot ended signal, so this
   * fires ~once a second for the life of the auction. Act only on the transition to
   * zero, and only once — without the `ended()` guard the hand-off would re-enter
   * load() on every tick after the clock runs out.
   */
  onTimer(event: { left: number }) {
    if (event?.left > 0 || this.ended()) return;
    this.ended.set(true);
    this.load();
  }

  prefill() {
    this.bid.set(this.minNextEth());
  }

  toggleBids() {
    this.bidsOpen.update((v) => !v);
  }

  /** `0x1234…abcd` — the full address would blow the row's width open. */
  shortAddr(a: string): string {
    return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
  }

  bidEth(v: bigint): string {
    return formatEther(v);
  }

  private async load() {
    try {
      const { auction, reservePrice, minBidIncrement } = await this.auctionSvc.getInitialData();
      this.auction.set(auction);
      this.minIncrement.set(minBidIncrement);
      this.ended.set(auction.endTime * 1000 < Date.now());

      const eth = await this.auctionSvc.getEthscriptionByHashId(auction.hashId);
      if (!eth) { this.itemSlug.set(''); return; }

      this.itemSlug.set(eth.slug);
      this.tokenId.set(eth.tokenId);
      this.image.set(await this.spriteSvc.url(eth.sha));

      // Per-item reserve wins over the house default when one is set.
      const itemReserve = await this.auctionSvc.getItemReservePrice(auction.hashId);
      this.reserveEth.set(formatEther(itemReserve > 0n ? itemReserve : reservePrice));

      // Bids come from the indexer, newest first. The list is height-capped in CSS, so
      // a long auction cannot grow the bar — however many land, the panel scrolls.
      this.bids.set(await this.auctionSvc.getBidHistory(auction.auctionId));
    } catch {
      // A collection page must never break because the auction house is unreachable.
      // Staying invisible is the correct failure here.
      this.itemSlug.set('');
    }
  }

  async placeBid() {
    const connected = await firstValueFrom(this.connected$);
    if (!connected) { this.web3Svc.connect(); return; }

    const value = this.bid().trim();
    if (!value || Number(value) <= 0) { this.error.set('Enter a bid amount'); return; }
    if (Number(value) < Number(this.minNextEth())) {
      this.error.set(`Minimum bid is ${this.minNextEth()} ETH`);
      return;
    }

    this.error.set('');
    this.pending.set(true);
    try {
      const hash = await this.auctionSvc.createBid(value);
      if (hash) {
        this.txHash.set(hash);
        await this.web3Svc.pollReceipt(hash);
        this.txHash.set('');
        this.bid.set('');
        await this.load();
      }
    } catch (err: any) {
      this.error.set(err?.shortMessage || err?.message || 'Bid failed');
    } finally {
      this.pending.set(false);
    }
  }
}
