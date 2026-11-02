import { Component, effect, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { TimeagoModule } from 'ngx-timeago';

import { DataService } from '@/services/data.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { PhunkImageComponent } from '@/components/phunk-image/phunk-image.component';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { tokenNumber } from '@/pipes/token-number.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';
import { GlobalState } from '@/models/global-state';
import { Event } from '@/models/db';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import { IS_BOT } from '@/utils/is-bot';

import { startWith, switchMap } from 'rxjs';

/**
 * A collection's newest sales, kept live.
 *
 * A "sale" is any event where the item changed hands for ETH, which is three
 * distinct types rather than one:
 *   PhunkBought    — bought outright off a listing
 *   BidAccepted    — owner accepted a standing bid
 *   AuctionSettled — won at auction (skipped when it settled with no bidder)
 *
 * Read by DataService.fetchRecentSales: one call with each item's picture joined
 * on, and the browser keeps what it has seen, so later reads ask only for newer sales.
 */
@Component({
  selector: 'app-collection-sales',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LazyLoadImageModule,
    TimeagoModule,
    PhunkImageComponent,
    WeiToEthPipe,
    FormatCashPipe,
  ],
  templateUrl: './collection-sales.component.html',
  styleUrls: ['./collection-sales.component.scss'],
})
export class CollectionSalesComponent {

  slug = input.required<string | undefined>();

  /** How many to render, and how many of each sale type are read (the newest of each is enough to fill it) */
  limit = input<number>(110);


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
      // crawlers get the page without the sales grid's reads
      if (IS_BOT) { this.loading.set(false); return; }
      const limit = this.limit();

      this.loading.set(true);

      // Re-pull whenever the collection's rows change — a new sale writes to
      // events and moves the item in ethscriptions, so this catches sales as
      // they land without polling. A plain insert listener would not work here:
      // a fresh events row has no slug/sha until it is joined.
      const sub = this.dataSvc.watchCollection(slug).pipe(
        startWith(null),
        switchMap(() => this.dataSvc.fetchRecentSales(slug, limit)),
      ).subscribe({
        next: (sales) => {
          this.sales.set(sales);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

      onCleanup(() => sub.unsubscribe());
    });
  }

  t(key: string, params?: Record<string, string | number>): string {
    return this.preferences.t(key, params);
  }

  displayId(e: Event): string {
    return tokenNumber(e.tokenId, e.slug);
  }

  // the same item can sell more than once and each sale must stay distinct
  trackSale = (i: number, e: Event) => `${e.hashId}-${e.blockTimestamp}-${e.type}-${i}`;
}
