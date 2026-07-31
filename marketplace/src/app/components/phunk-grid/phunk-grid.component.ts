import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { NgxPaginationModule } from 'ngx-pagination';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { WaIntersectionObserver } from '@ng-web-apis/intersection-observer';

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
    LazyLoadImageModule,
    NgxPaginationModule,
    WaIntersectionObserver,

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
  // Items escrowed in the auction house (owner == auctionAddress) are buyable at a fixed
  // per-item price via buyItem — but they carry no market `listing`, so the grid would show
  // them plain. We surface them like listings: highlighted tile + the wallet-resolved tier
  // price (public 0.267, EthsRocks "Diamond Hands" 0.167, etc.). Synthetic listings are
  // memoized so the template never builds new objects during change detection.
  private readonly auctionAddress = ((environment as any).auctionAddress || '').toLowerCase();
  private poolPriceWei: string | null = null;
  private poolListings = new Map<string, Listing>();

  constructor(
    private store: Store<GlobalState>,
    private el: ElementRef,
    public dataSvc: DataService,
    private poolBuySvc: PoolBuyNowService,
  ) {}

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

  /** Read the auction-house buy-now config once and resolve the price this wallet would pay,
   *  then (re)build the synthetic listing map. No-op (and no RPC) for grids with no pool items. */
  private async refreshPoolListings(): Promise<void> {
    const hasPoolItems = (this.phunkData || []).some(
      (p) => (p.owner || '').toLowerCase() === this.auctionAddress && !p.listing
    );
    if (!this.auctionAddress || !hasPoolItems) {
      this.poolPriceWei = null;
      if (this.poolListings.size) this.poolListings = new Map();
      return;
    }

    try {
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
    if (this.poolPriceWei) {
      for (const p of this.phunkData || []) {
        if ((p.owner || '').toLowerCase() === this.auctionAddress && !p.listing) {
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
