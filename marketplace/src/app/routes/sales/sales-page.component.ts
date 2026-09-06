import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';

import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';
import { DataService } from '@/services/data.service';
import { GlobalState } from '@/models/global-state';
import { Event, Phunk } from '@/models/db';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import { combineLatest, startWith, switchMap, map } from 'rxjs';

/**
 * Every sale of a collection, rendered exactly like the for-sale view.
 *
 * Rather than adding a 'sales' MarketType — which would thread through
 * market.state, the effects, the selectors and the market component — each sale
 * event is mapped onto the Phunk shape the grid already renders, with the sale
 * price hung on `listing.minValue`. PhunkGridComponent then draws it with the
 * same tile, price and USD treatment it uses for listings, for free.
 *
 * A "sale" is three event types, not one: PhunkBought (bought off a listing),
 * BidAccepted (owner took a standing bid) and AuctionSettled (won at auction).
 * ethsrocks alone has 5 / 2 / 8 of them, so filtering to PhunkBought would show
 * a third of the truth.
 */
@Component({
  selector: 'app-sales-page',
  standalone: true,
  imports: [CommonModule, RouterModule, PhunkGridComponent],
  templateUrl: './sales-page.component.html',
  styleUrls: ['./sales-page.component.scss'],
})
export class SalesPageComponent {

  private static readonly SALE_TYPES = ['PhunkBought', 'BidAccepted', 'AuctionSettled'] as const;
  private static readonly ZERO = '0x0000000000000000000000000000000000000000';

  slug = signal<string>('');
  /** Display name from the collections table — the slug still carries a legacy
   *  "og-" prefix that should never be shown to a user. */
  collectionName = signal<string>('');
  sales = signal<Phunk[]>([]);
  loading = signal<boolean>(true);

  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);

  constructor(
    private store: Store<GlobalState>,
    public dataSvc: DataService,
    public route: ActivatedRoute,
  ) {
    this.route.paramMap.pipe(
      map((p) => p.get('slug') || ''),
      switchMap((slug) => {
        this.slug.set(slug);
        this.loading.set(true);
        this.store.select(dataStateSelectors.selectCollections).subscribe((cols) => {
          const match = (cols ?? []).find((c: any) => c?.slug === slug);
          this.collectionName.set(match?.name || slug);
        });
        // Refresh off the collection's existing realtime channel so a new sale
        // shows up without a reload.
        return this.dataSvc.watchCollection(slug).pipe(
          startWith(null),
          switchMap(() => combineLatest(
            SalesPageComponent.SALE_TYPES.map((type) =>
              this.dataSvc.fetchEvents(0, 1000, type as any, slug),
            ),
          )),
        );
      }),
    ).subscribe({
      next: (groups) => {
        const merged = groups
          .flat()
          .filter((e) => this.isRealSale(e))
          .sort((a, b) => this.time(b) - this.time(a))
          .map((e) => this.toPhunk(e));
        this.sales.set(merged);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** An auction that ended with no bidder never changed hands. */
  private isRealSale(e: Event): boolean {
    if (e.type === 'AuctionSettled' && (!e.to || e.to === SalesPageComponent.ZERO)) return false;
    return !!e.value && e.value !== '0';
  }

  private time(e: Event): number {
    return e.blockTimestamp ? new Date(e.blockTimestamp).getTime() : 0;
  }

  /** Sale event -> the Phunk shape the grid draws, price carried as a listing. */
  private toPhunk(e: Event): Phunk {
    return {
      slug: e.slug ?? this.slug(),
      hashId: e.hashId,
      tokenId: e.tokenId ?? 0,
      createdAt: e.blockTimestamp as Date,
      owner: e.to,
      prevOwner: e.from,
      sha: e.sha,
      listing: {
        createdAt: e.blockTimestamp as Date,
        hashId: e.hashId,
        listed: false,
        listedBy: e.from,
        minValue: e.value ?? '0',
        toAddress: e.to,
      },
    } as Phunk;
  }
}
