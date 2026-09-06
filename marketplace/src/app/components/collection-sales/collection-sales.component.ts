import { Component, effect, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { TimeagoModule } from 'ngx-timeago';

import { DataService } from '@/services/data.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';
import { GlobalState } from '@/models/global-state';
import { Event } from '@/models/db';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import { combineLatest, of, startWith, switchMap } from 'rxjs';

/**
 * Every sale a collection has ever had, newest first, kept live.
 *
 * A "sale" is any event where the item changed hands for ETH, which is three
 * distinct types rather than one:
 *   PhunkBought    — bought outright off a listing
 *   BidAccepted    — owner accepted a standing bid
 *   AuctionSettled — won at auction (skipped when it settled with no bidder)
 * Showing only PhunkBought would silently under-report; ethsrocks for example
 * has 5 PhunkBought against 8 AuctionSettled and 2 BidAccepted.
 *
 * The events table itself carries no slug/sha — those come from a join onto
 * ethscriptions, which the fetch_events RPC already does, so everything is
 * pulled through that rather than queried directly.
 */
@Component({
  selector: 'app-collection-sales',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LazyLoadImageModule,
    TimeagoModule,
    WeiToEthPipe,
    FormatCashPipe,
  ],
  templateUrl: './collection-sales.component.html',
  styleUrls: ['./collection-sales.component.scss'],
})
export class CollectionSalesComponent {

  slug = input.required<string | undefined>();

  /** How many to render. Everything is fetched so the total is honest. */
  limit = input<number>(110);

  private static readonly SALE_TYPES = ['PhunkBought', 'BidAccepted', 'AuctionSettled'] as const;
  private static readonly ZERO = '0x0000000000000000000000000000000000000000';

  sales = signal<Event[]>([]);
  loading = signal<boolean>(true);

  usd$ = this.store.select(dataStateSelectors.selectDisplayUsd);

  constructor(
    private store: Store<GlobalState>,
    public dataSvc: DataService,
    public preferences: PhunkPreferencesService,
  ) {
    effect((onCleanup) => {
      const slug = this.slug();
      if (!slug) return;

      this.loading.set(true);

      // Re-pull whenever the collection's rows change — a new sale writes to
      // events and moves the item in ethscriptions, so this catches sales as
      // they land without polling. A plain insert listener would not work here:
      // a fresh events row has no slug/sha until it is joined.
      const sub = this.dataSvc.watchCollection(slug).pipe(
        startWith(null),
        switchMap(() => combineLatest(
          CollectionSalesComponent.SALE_TYPES.map((type) =>
            this.dataSvc.fetchEvents(0, 1000, type as any, slug),
          ),
        )),
      ).subscribe({
        next: (groups) => {
          const merged = groups
            .flat()
            .filter((e) => this.isRealSale(e))
            .sort((a, b) => this.time(b) - this.time(a));
          this.sales.set(merged);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

      onCleanup(() => sub.unsubscribe());
    });
  }

  /** An auction that ended with no bidder is not a sale. */
  private isRealSale(e: Event): boolean {
    if (e.type === 'AuctionSettled') {
      if (!e.to || e.to === CollectionSalesComponent.ZERO) return false;
    }
    return !!e.value && e.value !== '0';
  }

  private time(e: Event): number {
    return e.blockTimestamp ? new Date(e.blockTimestamp).getTime() : 0;
  }

  t(key: string): string {
    return this.preferences.t(key);
  }

  displayId(e: Event): string {
    const id = e.tokenId ?? 0;
    const abs = id < 0 ? -id : id;
    return e.slug === 'ethsrocks' ? `-${abs}` : `${abs}`;
  }

  // fetch_events does not return txHash, so it cannot be part of the key — the
  // same item can sell more than once and each sale must stay distinct.
  trackSale = (i: number, e: Event) => `${e.hashId}-${e.blockTimestamp}-${e.type}-${i}`;
}
