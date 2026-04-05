import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { WaIntersectionObserver } from '@ng-web-apis/intersection-observer';

import { Store } from '@ngrx/store';
import { TimeagoModule } from 'ngx-timeago';
import { LazyLoadImageModule } from 'ng-lazyload-image';

import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';
import { RecentActivityComponent } from '@/components/recent-activity/recent-activity.component';
import { SplashComponent } from '@/components/splash/splash.component';
import { BrbComponent } from '@/components/brb/brb.component';
import { MintComponent } from '@/components/mint/mint.component';
import { CalcPipe } from '@/pipes/calculate.pipe';
import { MosaicComponent } from '@/components/mosaic/mosaic.component';

import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';

import { GlobalState } from '@/models/global-state';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as marketStateSelectors from '@/state/selectors/market-state.selectors';
import { combineLatest, map, tap } from 'rxjs';

// Navigation links between OG and Quantum collections (independent of evolve contract)
const LINKED_SLUG_MAP: Record<string, string> = {
  'og-missing-phunks': 'quantummissingphunksv67',
  'og-dysto-phunks': 'quantumdystophunkzv67',
  'quantummissingphunksv67': 'og-missing-phunks',
  'quantumdystophunkzv67': 'og-dysto-phunks',
};

@Component({
  standalone: true,
  imports: [
    CommonModule,
    TimeagoModule,
    RouterModule,
    LazyLoadImageModule,
    WaIntersectionObserver,

    SplashComponent,
    PhunkGridComponent,
    RecentActivityComponent,
    BrbComponent,
    MintComponent,
    MosaicComponent,
    CalcPipe,
  ],
  selector: 'app-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.scss']
})

export class IndexComponent {

  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  connected$ = this.store.select(appStateSelectors.selectConnected);
  activeCollection$ = this.store.select(dataStateSelectors.selectActiveCollection);

  owned$ = this.store.select(marketStateSelectors.selectOwned);
  listings$ = this.store.select(marketStateSelectors.selectListings);
  bids$ = this.store.select(marketStateSelectors.selectBids);
  all$ = this.store.select(marketStateSelectors.selectAll);

  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);
  usd$ = this.store.select(dataStateSelectors.selectUsd);

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

  faqItems = [
    { q: 'What is a QuantumPhunk?', a: 'QuantumPhunks is a collection of 10,386 unique collectible characters stored fully on-chain as Ethscriptions on the Ethereum blockchain. The initial release features 4,037 turtle characters with more to follow.' },
    { q: 'What exactly is going on here?', a: 'This is the home of DystoLabz collections. A marketplace for buying, selling, and exploring QuantumPhunks and related collections. All transactions happen on-chain through smart contracts originally forked from Chopperdad\'s EtherPhunks Market and Phunks Auction House, built upon and evolved by DystoLabz.' },
    { q: 'How do I get one?', a: 'You can buy one from the marketplace listings, win one through the lottery, or through our auction house.' },
    { q: 'Where are the images stored?', a: 'All images are stored fully on-chain as Ethscriptions, encoded directly into the calldata of Ethereum transactions by us. No IPFS, no servers, no external hosting.' },
    { q: 'Where does the market data on this site come from?', a: 'The prices and sales you see on this site are loaded from the marketplace contracts on the Ethereum blockchain.' },
    { q: 'Are they an ERC-721 token?', a: 'No. They are Ethscriptions, not ERC-721 tokens. Ownership is managed on-chain through our smart contracts and Ethereum transfer history.' },
    { q: 'Do you charge any fees for transactions?', a: 'No. There are zero fees and zero royalties on all marketplace transactions.' },
  ];

  toggleFaq(q: string) {
    this.openFaq.set(this.openFaq() === q ? null : q);
  }

  constructor(
    private store: Store<GlobalState>,
    public themeSvc: ThemeService,
    public dataSvc: DataService,
    public route: ActivatedRoute
  ) {}

}
