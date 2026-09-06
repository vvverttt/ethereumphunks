import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { NgxPaginationModule } from 'ngx-pagination';
import { WaIntersectionObserver } from '@ng-web-apis/intersection-observer';
import { TimeagoModule } from 'ngx-timeago';

import { GlobalState, TraitFilter } from '@/models/global-state';
import { MarketType } from '@/models/market.state';
import { ViewType } from '@/models/view-types';
import { Phunk, Listing } from '@/models/db';
import { Sort } from '@/models/pipes';

import { DataService } from '@/services/data.service';
import { PoolBuyNowService } from '@/services/pool-buy-now.service';

import { ItemLinkPipe } from '@/pipes/item-link.pipe';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';
import { SortPipe } from '@/pipes/sort.pipe';
import { AttributeFilterPipe } from '@/pipes/attribute-filter';
import { ImageUrlPipe } from '@/pipes/image-url.pipe';

import { environment } from 'src/environments/environment';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import * as marketStateActions from '@/state/actions/market-state.actions';

@Component({
  selector: 'app-phunk-grid',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgxPaginationModule,
    WaIntersectionObserver,
    TimeagoModule,

    WeiToEthPipe,
    FormatCashPipe,
    SortPipe,
    AttributeFilterPipe,
    ItemLinkPipe,
    ImageUrlPipe,
  ],
  host:  {
    '[class.selectable]': 'selectable',
    '[class]': 'viewType',
  },
  templateUrl: './phunk-grid.component.html',
  styleUrls: ['./phunk-grid.component.scss']
})

export class PhunkGridComponent implements OnChanges {

  escrowAddress = environment.marketAddress;
  // Any marketplace contract that holds escrowed items (real owner = prevOwner):
  // our V3 market AND the old EtherPhunks market (where OG items get listed).
  private escrowAddresses = new Set<string>(
    [environment.marketAddress, ...(((environment as any).oldMarketAddresses) || [])]
      .filter(Boolean).map((a: string) => a.toLowerCase())
  );

  @Input() marketType!: MarketType;
  @Input() activeSort!: Sort['value'];

  @Input() viewType: ViewType = 'market';
  @Input() phunkData!: Phunk[];
  @Input() total: number = 0;
  @Input() limit: number = 0;

  @Input() showLabels: boolean = true;
  /** Show when the price happened (sales view); off for live listings, where
   *  the tile already means "currently for sale". */
  @Input() showDate: boolean = false;
  @Input() traitFilters!: TraitFilter | null;
  @Input() observe: boolean = false;

  @Input() selectable: boolean = false;
  @Input() selectAll: boolean = false;

  @Input() walletAddress!: string | null | undefined;

  @Output() selectedChange = new EventEmitter<{ [string: Phunk['hashId']]: Phunk }>();
  @Input() selected: { [string: Phunk['hashId']]: Phunk } = {};

  limitArr = Array.from({length: this.limit}, (_, i) => i);

  usd$ = this.store.select(dataStateSelectors.selectDisplayUsd);

  showLoadMore: boolean = false;

  private filterPipe = new AttributeFilterPipe();

  // ── Pool buy-now display ──────────────────────────────────────────────────
  // Items escrowed in the auction house are buyable at a fixed per-item price via buyItem — but
  // they carry no market `listing`, so the grid would show them plain. We surface them like
  // listings: highlighted tile + the wallet-resolved tier price (public 0.267, EthsRocks
  // "Diamond Hands" 0.167, etc.). The /market/all data has no `owner`, so pool membership comes
  // from a separate hashId lookup. Synthetic listings are memoized so the template never builds
  // new objects during change detection.
  private readonly auctionAddress = ((environment as any).auctionAddress || '').toLowerCase();
  private poolHashIds = new Set<string>();
  private poolSlug = '';
  private poolPriceWei: string | null = null;
  private poolListings = new Map<string, Listing>();

  constructor(
    private store: Store<GlobalState>,
    private el: ElementRef,
    public dataSvc: DataService,
    private poolBuySvc: PoolBuyNowService,
  ) {}

  // Grid images are static (Supabase/CDN), so a blank tile is always a transient fetch failure
  // (single-host connection cap / CDN throttle), never a missing image. ng-lazyload-image left
  // those stuck forever; native lazy-loading + this bounded retry guarantees every tile eventually
  // loads. The themed .image-wrapper background is the placeholder while it retries.
  /**
   * Marks the tile as painted so the loading placeholder behind it is dropped.
   *
   * The placeholder lives on the WRAPPER, not the img, because phunk art is
   * transparent — left underneath, it would show through every gap in the pixel
   * art. The class is toggled here rather than with CSS :has() so it does not
   * depend on selector support.
   */
  imgSettled(e: Event): void {
    const img = e.target as HTMLImageElement;
    img.classList.add('loaded');
    img.parentElement?.classList.add('img-loaded');
  }

  retryImg(e: Event): void {
    const img = e.target as HTMLImageElement;
    const n = +(img.dataset['retry'] || 0);
    if (n >= 4) {                                    // give up after 4 tries -> gray placeholder
      if (!img.src.endsWith('loadingphunk.png')) img.src = 'assets/loadingphunk.png';
      // Nothing further is coming — reveal whatever is there rather than
      // leaving the tile stuck at opacity 0 forever.
      this.imgSettled(e);
      return;
    }
    img.dataset['retry'] = String(n + 1);
    const base = img.src.split('?')[0];
    // backoff + jitter, and a changing query so the browser makes a fresh request (not a cached error)
    setTimeout(() => { img.src = base + '?r=' + (n + 1); }, 500 * (n + 1) + Math.floor(Math.random() * 300));
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Selected state is reflected reactively via [class.checked]; no DOM work needed.

    if (changes.selectAll && this.phunkData) {
      for (const phunk of this.phunkData) {
        this.selectPhunk(phunk, true, !this.selectAll);
      }
    }

    if (changes.traitFilters && !changes.traitFilters.firstChange) {
      this.limit = 250;
    }

    // Show Load More when there are more items to render or fetch
    if (changes.phunkData || changes.total || changes.limit || changes.traitFilters) {
      this.updateShowLoadMore();
    }

    // Recompute pool buy-now prices when the data or the connected wallet changes
    // (wallet change flips the eligible tier, e.g. Diamond Hands -> 0.167).
    if (changes.phunkData || changes.walletAddress) {
      void this.refreshPoolListings();
    }
  }

  /** The listing to render for an item: a real market listing wins; otherwise the synthetic
   *  pool buy-now listing (present only for auction-house-escrowed items when buy-now is on). */
  displayListing(phunk: Phunk): Listing | null {
    return phunk.listing ?? this.poolListings.get(phunk.hashId) ?? null;
  }

  /** Load which items are in the auction-house pool (by hashId) and resolve the price this wallet
   *  would pay, then (re)build the synthetic listing map. No-op for collections with no pool items. */
  private async refreshPoolListings(): Promise<void> {
    const slug = (this.phunkData || []).find((p) => p.slug)?.slug || '';
    if (!this.auctionAddress || !slug) {
      this.poolPriceWei = null;
      if (this.poolListings.size) this.poolListings = new Map();
      return;
    }

    try {
      // Pool membership only depends on the collection — cache per slug so a wallet change
      // (which re-prices) doesn't re-query the set.
      if (slug !== this.poolSlug) {
        this.poolHashIds = await this.dataSvc.fetchPoolHashIds(slug);
        this.poolSlug = slug;
      }
      if (!this.poolHashIds.size) {
        this.poolPriceWei = null;
        this.poolListings = new Map();
        return;
      }
      const config = await this.poolBuySvc.getConfig();
      const tier = await this.poolBuySvc.resolveTier(this.walletAddress, config);
      this.poolPriceWei = tier ? tier.priceWei.toString() : null;
    } catch {
      this.poolPriceWei = null;
    }
    this.rebuildPoolListingsMap();
  }

  private rebuildPoolListingsMap(): void {
    const next = new Map<string, Listing>();
    if (this.poolPriceWei && this.poolHashIds.size) {
      for (const p of this.phunkData || []) {
        if (!p.listing && this.poolHashIds.has((p.hashId || '').toLowerCase())) {
          next.set(p.hashId, {
            createdAt: new Date(),
            hashId: p.hashId,
            listed: true,
            listedBy: this.auctionAddress,
            minValue: this.poolPriceWei,
            toAddress: null,
          });
        }
      }
    }
    this.poolListings = next;
  }

  selectPhunk(
    phunk: Phunk,
    upsert: boolean = false,
    remove: boolean = false
  ) {
    if (remove) {
      const selected = { ...this.selected };
      delete selected[phunk.hashId];
      this.selected = selected;
      this.selectedChange.emit(this.selected);
      return;
    }

    if (upsert) {
      if (!this.selected[phunk.hashId]) this.selected[phunk.hashId] = phunk;
    } else {
      if (this.selected[phunk.hashId]) {
        const selected = { ...this.selected };
        delete selected[phunk.hashId];
        this.selected = selected;
      } else {
        this.selected[phunk.hashId] = phunk;
      }
    }

    this.selectedChange.emit(this.selected);
  }

  /**
   * A bid is "dead" when it was placed against an owner who no longer holds the item
   * (the item was sold/transferred after the bid). It can no longer be accepted — the
   * bidder can only withdraw it — so it's shown greyed-out in the bids grid.
   */
  isDeadBid(phunk: Phunk): boolean {
    const bid = phunk?.bid;
    if (!bid || !bid.ownerAddress) return false;
    // When the item sits in the market escrow, owner == market address and the true
    // owner is prevOwner. Detect escrow by address directly (the bids grid data doesn't
    // always set phunk.isEscrowed) to avoid false "dead" flags on live escrowed bids.
    const owner = (phunk.owner || '').toLowerCase();
    // Escrowed (real owner = prevOwner) if held by any marketplace contract — our V3
    // market OR the old EtherPhunks market (OG items list there).
    const isEscrowed = phunk.isEscrowed === true || this.escrowAddresses.has(owner);
    const effectiveOwner = (isEscrowed ? (phunk.prevOwner || '') : (phunk.owner || '')).toLowerCase();
    if (!effectiveOwner) return false;
    return effectiveOwner !== bid.ownerAddress.toLowerCase();
  }

  onIntersection($event: IntersectionObserverEntry[]): void {
    if (!this.observe || !this.phunkData) return;
  }

  loadMore() {
    this.limit += 250;

    // Fetch more from server if we've rendered all fetched data
    if (this.marketType === 'all' && this.phunkData && this.limit >= this.phunkData.length && this.phunkData.length < this.total) {
      this.store.dispatch(
        marketStateActions.setPagination({
          pagination: {
            fromIndex: this.phunkData.length,
            toIndex: this.phunkData.length + 250,
          }
        })
      );
    }

    this.updateShowLoadMore();
  }

  private updateShowLoadMore(): void {
    if (!this.phunkData) {
      this.showLoadMore = false;
      return;
    }
    const filteredCount = this.filterPipe.transform(this.phunkData, this.traitFilters).length;
    this.showLoadMore = this.limit < filteredCount || this.phunkData.length < this.total;
  }

  childrenLength() {
    return [...this.el.nativeElement.children].filter((child: HTMLElement) => !child.classList.contains('more')).length;
  }
}
