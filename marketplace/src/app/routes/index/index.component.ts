import { FiatPipe } from '@/pipes/fiat.pipe';
import { Component, signal } from '@angular/core';
import { InternalLinksDirective } from '@/directives/internal-links.directive';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { WaIntersectionObserver } from '@ng-web-apis/intersection-observer';

import { Store } from '@ngrx/store';
import { TimeagoModule } from 'ngx-timeago';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';
import { RecentActivityComponent } from '@/components/recent-activity/recent-activity.component';
import { SplashComponent } from '@/components/splash/splash.component';
import { AuctionStripComponent } from '@/components/auction-strip/auction-strip.component';
import { BrbComponent } from '@/components/brb/brb.component';
import { MintComponent } from '@/components/mint/mint.component';
import { CalcPipe } from '@/pipes/calculate.pipe';
import { MosaicComponent } from '@/components/mosaic/mosaic.component';
import { CollectionStatsComponent } from '@/components/collection-stats/collection-stats.component';
import { CollectionSalesComponent } from '@/components/collection-sales/collection-sales.component';
import { CollectionIntroComponent } from '@/components/collection-intro/collection-intro.component';
import { CollectionSearchComponent } from '@/components/collection-search/collection-search.component';

import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

import { GlobalState } from '@/models/global-state';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as marketStateSelectors from '@/state/selectors/market-state.selectors';
import { combineLatest, map, tap } from 'rxjs';
import { environment } from 'src/environments/environment';

// Navigation links between OG and Quantum collections (independent of evolve contract).
// One-way on purpose: the Quantum re-issues are no longer surfaced, so the OG pages must
// not advertise them. The reverse direction stays so anyone landing on a Quantum page by
// direct URL can still get back to the OG collection.
const LINKED_SLUG_MAP: Record<string, string> = {
  'quantummissingphunksv67': 'missing-phunks',
  'quantumdystophunkzv67': 'dysto-phunks',
};

@Component({
  standalone: true,
  imports: [
    FiatPipe,
    InternalLinksDirective,
    CommonModule,
    TimeagoModule,
    RouterModule,
    LazyLoadImageModule,
    WaIntersectionObserver,

    SplashComponent,
    AuctionStripComponent,
    PhunkGridComponent,
    RecentActivityComponent,
    BrbComponent,
    MintComponent,
    MosaicComponent,
    CollectionStatsComponent,
    CollectionSalesComponent,
    CollectionIntroComponent,
    CollectionSearchComponent,
    CalcPipe,
  ],
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})

export class IndexComponent {

  env = environment;

  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  connected$ = this.store.select(appStateSelectors.selectConnected);
  activeCollection$ = this.store.select(dataStateSelectors.selectActiveCollection);

  owned$ = this.store.select(marketStateSelectors.selectOwned);
  listings$ = this.store.select(marketStateSelectors.selectListings);
  bids$ = this.store.select(marketStateSelectors.selectBids);
  all$ = this.store.select(marketStateSelectors.selectAll);

  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);
  usd$ = this.store.select(dataStateSelectors.selectDisplayUsd);

  config$ = this.store.select(appStateSelectors.selectConfig);

  ogCollection$ = combineLatest([
    this.activeCollection$,
    this.store.select(dataStateSelectors.selectCollections),
  ]).pipe(
    map(([active, collections]) => {
      if (!active || !collections) return null;
      const linkedSlug = LINKED_SLUG_MAP[active.slug];
      if (!linkedSlug) return null;
      return collections.find(c => c.slug === linkedSlug) || null;
    })
  );

  mintImage = signal<string | null>(null);

  openFaq = signal<string | null>(null);

  /** The Q&A for the active collection (its own list, or the default), in the current
   *  language. The copy lives in i18n/content.<lang>.ts. */
  private faqSlug = signal('');
  get faqItems(): { q: string; a: string }[] {
    const faq = this.preferences.content().faq;
    return faq[this.faqSlug()] || faq['default'] || [];
  }

  toggleFaq(q: string) {
    this.openFaq.set(this.openFaq() === q ? null : q);
  }

  constructor(
    private store: Store<GlobalState>,
    public themeSvc: ThemeService,
    public dataSvc: DataService,
    public route: ActivatedRoute,
    public preferences: PhunkPreferencesService,
  ) {
    this.activeCollection$.subscribe((collection) => {
      if (!collection) return;
      this.faqSlug.set(collection.slug);
    });
  }

  t(key: string): string {
    return this.preferences.t(key);
  }


}
