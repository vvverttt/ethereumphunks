import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { WaIntersectionObserver } from '@ng-web-apis/intersection-observer';

import { Phunk } from '@/models/db';
import { GlobalState, Notification } from '@/models/global-state';

import { Web3Service } from '@/services/web3.service';
import { AdminService } from '@/services/admin.service';
import { MenuFont, MenuLanguage, PhunkPreferencesService } from '@/services/phunk-preferences.service';

import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';
import { NotificationComponent } from '@/components/notifications/notification/notification.component';
import { LeaderboardComponent } from '@/components/leaderboard/leaderboard.component';
import { CollectionsComponent } from '@/components/collections/collections.component';
import { StatusBarComponent } from '@/components/status-bar/status-bar.component';
import { MenuAuctionComponent } from '@/components/menu-auction/menu-auction.component';
import { PhunkImageComponent } from '@/components/phunk-image/phunk-image.component';
import { ERC721C_CONTRACTS } from '@/constants/erc721c';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as dataStateActions from '@/state/actions/data-state.actions';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as notificationSelectors from '@/state/selectors/notification.selectors';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import * as marketStateSelectors from '@/state/selectors/market-state.selectors';

import { FormatCashPipe } from '@/pipes/format-cash.pipe';

import { combineLatest, from, map, of, switchMap, tap } from 'rxjs';
import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';

import anime from 'animejs';

import { environment } from '@/../environments/environment';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    PhunkImageComponent,
    CommonModule,
    WaIntersectionObserver,
    RouterModule,

    PhunkGridComponent,
    NotificationComponent,
    LeaderboardComponent,
    CollectionsComponent,
    StatusBarComponent,
    MenuAuctionComponent,
    FormatCashPipe,

    WalletAddressDirective
  ],
  host: {
    style: 'transform: translateX(100%);',
  },
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})
export class MenuComponent {

  @ViewChild('menuMain') menuMain!: ElementRef;
  @ViewChild('menuLeaderboard') menuLeaderboard!: ElementRef;
  @ViewChild('menuCurated') menuCurated!: ElementRef;

  address$ = this.store.select(appStateSelectors.selectWalletAddress);
  connected$ = this.store.select(appStateSelectors.selectConnected);
  menuActive$ = this.store.select(appStateSelectors.selectMenuActive).pipe(
    tap((active) => {
      active && this.store.dispatch(dataStateActions.fetchLeaderboard());
      !active && this.store.dispatch(appStateActions.setActiveMenuNav({ activeMenuNav: 'main' }));
    }),
  );
  // Plain open/closed for the template — menuActive$ above has side effects (leaderboard fetch)
  // that a second subscriber would repeat.
  menuOpen$ = this.store.select(appStateSelectors.selectMenuActive);

  activeMenuNav$ = this.store.select(appStateSelectors.selectActiveMenuNav);
  activeCollection$ = this.store.select(dataStateSelectors.selectActiveCollection);

  private dataSvc = inject(DataService);
  private themeSvc = inject(ThemeService);

  /**
   * The connected wallet's pieces grouped by collection, in the collections list's order, each
   * with its theme colours. Loaded once the menu opens (one light query, cached 5 minutes);
   * listing status comes from the current collection's owned list already in the store.
   */
  walletGroups$ = combineLatest([
    this.store.select(appStateSelectors.selectConnected),
    this.address$,
    this.store.select(appStateSelectors.selectMenuActive),
  ]).pipe(
    switchMap(([connected, address, open]) => connected && address && open
      ? combineLatest([
          from(this.dataSvc.fetchOwnedAllCollections(address)),
          this.store.select(dataStateSelectors.selectCollections),
          this.store.select(marketStateSelectors.selectOwned),
          this.config$,
        ])
      : of(null)),
    map((v) => {
      if (!v) return null;
      const [items, collections, ownedHere, config] = v as [Phunk[], any[], Phunk[] | null, any];
      const listed = new Map((ownedHere || []).map(p => [p.hashId, p.listing]));
      const hidden: string[] = config?.hiddenSlugs || [];
      const groups = [];
      for (const c of collections || []) {
        if (hidden.includes(c.slug)) continue;
        const mine = items.filter(p => p.slug === c.slug).map(p => ({ ...p, listing: listed.get(p.hashId) ?? null }));
        if (!mine.length) continue;
        const o = this.themeSvc.collectionOverrides[c.slug] || {};
        groups.push({
          slug: c.slug, name: c.name, single: c.singleName || c.name, logo: c.image || null, items: mine,
          tile: o['--phunk-bg'] || '195, 255, 0',
          accent: o['--pink'] || (c.slug === 'cryptophunksv67' ? '103, 205, 255' : '255, 4, 180'),
          bg: o['--background'] || '17, 26, 0',
        });
      }
      return groups;
    }),
  );

  walletTotal(groups: { items: unknown[] }[]) {
    return groups.reduce((n, g) => n + g.items.length, 0);
  }

  /** v67 pieces open by contract + token id, everything else by hashId. */
  detailsLink(p: Phunk): any[] {
    const contract = ERC721C_CONTRACTS[p.slug];
    return contract ? ['/details', contract, p.tokenId] : ['/details', p.hashId];
  }

  listedPhunks$ = this.store.select(marketStateSelectors.selectOwned).pipe(
    tap((owned: Phunk[] | null) => this.createOwnedStats(owned)),
    map((owned) => owned?.filter((phunk: Phunk) => !!phunk.listing)),
  );

  // userOpenBids$ = this.store.select(dataStateSelectors.selectUserOpenBids).pipe(
  //   tap((bids: Phunk[] | null) => this.createBidStats(bids))
  // );

  notifications$ = this.store.select(notificationSelectors.selectNotifications).pipe(
    map((txns: Notification[]) => [...txns].sort((a, b) => b.timestamp - a.timestamp))
  );

  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);
  hasWithdrawal$ = this.store.select(appStateSelectors.selectHasWithdrawal);
  leaderboard$ = this.store.select(dataStateSelectors.selectLeaderboard);

  stats: any = {
    owned: 0,
    escrowed: 0,
    listed: 0,
  };

  menuTimeline!: anime.AnimeTimelineInstance;
  menuSeen = signal(false);

  isStandaloneMarket = environment.standalone;
  isOwner = signal(false);
  config$ = this.store.select(appStateSelectors.selectConfig);
  private preferences = inject(PhunkPreferencesService);
  currentLanguage = this.preferences.currentLanguage;
  currentFont = this.preferences.currentFont;
  languageOptions = this.preferences.languageOptions;
  fontOptions = this.preferences.fontOptions;

  constructor(
    private store: Store<GlobalState>,
    private web3Svc: Web3Service,
    private adminSvc: AdminService,
    private el: ElementRef,
  ) {
    this.menuActive$.pipe(
      switchMap((active) => {
        if (active) this.checkOwner();
        return this.activeMenuNav$.pipe(
          switchMap((menuNav) => {
            if (active) this.menuSeen.set(active);

            this.menuTimeline = anime.timeline({
              easing: 'cubicBezier(0.85, 0, 0.30, 1.01)',
              duration: 400,
            }).add({
              targets: this.el?.nativeElement,
              translateX: active ? '0' : '100%',
            }).add({
              targets: this.menuMain?.nativeElement,
              opacity: menuNav === 'main' ? 1 : 0,
              translateX: menuNav === 'main' ? '0' : '100%',
            }, '-=400').add({
              targets: this.menuLeaderboard?.nativeElement,
              opacity: menuNav === 'leaderboard' ? 1 : 0,
              translateX: menuNav === 'leaderboard' ? '0' : '100%',
            }, '-=400').add({
              targets: this.menuCurated?.nativeElement,
              opacity: menuNav === 'curated' ? 1 : 0,
              translateX: menuNav === 'curated' ? '0' : '100%',
            }, '-=400');

            return from(this.menuTimeline.finished);
          })
        );
      }),
    ).subscribe();
  }

  private async checkOwner(): Promise<void> {
    try {
      const owner = await this.adminSvc.getMarketOwner();
      const address = this.web3Svc.getCurrentAddress();
      this.isOwner.set(!!address && owner.toLowerCase() === address.toLowerCase());
    } catch {
      this.isOwner.set(false);
    }
  }

  async disconnect(): Promise<void> {
    await this.web3Svc.disconnectWeb3();
    this.store.dispatch(appStateActions.setMenuActive({ menuActive: false }));
  }

  async withdraw(): Promise<void> {
    await this.web3Svc.withdraw();
    this.store.dispatch(appStateActions.checkHasWithdrawal());
  }

  createOwnedStats(owned: Phunk[] | null) {
    if (!owned) return;

    // Get all the attributes
    const allTraits = owned?.map((phunk: Phunk) => phunk.attributes);
    const traits = allTraits?.reduce((acc: any, val: any) => acc.concat(val), []);

    // Count the occurrences of each attribute
    const traitCounts = traits?.reduce((acc: {[key: string]: number}, trait: {k: string, v: string}) => {
      if (!trait) return acc;
      const key = `${trait.k}:${trait.v}`; // creates a unique key from the k:v pair
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const males = traitCounts?.['Sex:Male'] || 0;
    const females = traitCounts?.['Sex:Female'] || 0;

    // Remove the counts for "Male" and "Female" to get rare traits excluding "Sex"
    delete traitCounts?.['Sex:Male'];
    delete traitCounts?.['Sex:Female'];

    // Convert the frequency object to a sorted array of [key, count] pairs
    const sortedTraits = traitCounts ? Object.entries(traitCounts).sort((a: any, b: any) => a[1] - b[1]) : []; // Note: We sort in ascending order now to get the rarest

    // Get the top 3 most rare traits
    const top3RarestTraits = sortedTraits.slice(0, 3);

    // console.log(top3RarestTraits);

    const escrowed = owned?.filter((phunk: Phunk) => phunk.isEscrowed)?.length;
    const listed = owned?.filter((phunk: Phunk) => phunk.listing)?.length;

    this.stats = {
      ...this.stats,
      owned: owned?.length,
      escrowed,
      listed,
    };
  }

  createBidStats(bids: Phunk[] | null) {
    if (!bids) return;

    const totalBidValue = bids.reduce((acc, phunk) => {
      const val = this.web3Svc.weiToEth(phunk.bid?.value) || '0';
      return acc + Number(val);
    }, 0);

    this.stats = {
      ...this.stats,
      bids: bids?.length,
      bidsValue: totalBidValue,
    };
  }

  navigateMenu(activeMenuNav: GlobalState['appState']['activeMenuNav']): void {
    this.store.dispatch(appStateActions.setActiveMenuNav({ activeMenuNav }));
  }

  t(key: string): string {
    return this.preferences.t(key);
  }

  setLanguage(language: MenuLanguage): void {
    this.preferences.setLanguage(language);
  }

  setFont(font: MenuFont): void {
    this.preferences.setFont(font);
  }

  goToLottery(): void {
    this.store.dispatch(appStateActions.setMenuActive({ menuActive: false }));
  }

  goToAuction(): void {
    this.store.dispatch(appStateActions.setMenuActive({ menuActive: false }));
  }

  goToVault(): void {
    this.store.dispatch(appStateActions.setMenuActive({ menuActive: false }));
  }

  goToAdmin(): void {
    this.store.dispatch(appStateActions.setMenuActive({ menuActive: false }));
  }
}
