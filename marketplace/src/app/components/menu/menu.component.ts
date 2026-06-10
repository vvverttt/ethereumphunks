import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { WaIntersectionObserver } from '@ng-web-apis/intersection-observer';

import { Phunk } from '@/models/db';
import { GlobalState, Notification } from '@/models/global-state';

import { Web3Service } from '@/services/web3.service';
import { AdminService } from '@/services/admin.service';
import { LikesService, TopLikedItem } from '@/services/likes.service';
import { MenuFont, MenuLanguage, PhunkPreferencesService } from '@/services/phunk-preferences.service';

import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';
import { NotificationComponent } from '@/components/notifications/notification/notification.component';
import { LeaderboardComponent } from '@/components/leaderboard/leaderboard.component';
import { MostLikesComponent } from '@/routes/most-likes/most-likes.component';
import { CollectionsComponent } from '@/components/collections/collections.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as dataStateActions from '@/state/actions/data-state.actions';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as notificationSelectors from '@/state/selectors/notification.selectors';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import * as marketStateSelectors from '@/state/selectors/market-state.selectors';

import { FormatCashPipe } from '@/pipes/format-cash.pipe';

import { from, map, switchMap, tap } from 'rxjs';

import anime from 'animejs';

import { environment } from '@/../environments/environment';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [
    CommonModule,
    WaIntersectionObserver,
    RouterModule,

    PhunkGridComponent,
    NotificationComponent,
    LeaderboardComponent,
    MostLikesComponent,
    CollectionsComponent,
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
  @ViewChild('menuMostLikes') menuMostLikes!: ElementRef;
  @ViewChild('menuCurated') menuCurated!: ElementRef;

  address$ = this.store.select(appStateSelectors.selectWalletAddress);
  connected$ = this.store.select(appStateSelectors.selectConnected);
  menuActive$ = this.store.select(appStateSelectors.selectMenuActive).pipe(
    tap((active) => {
      active && this.store.dispatch(dataStateActions.fetchLeaderboard());
      active && this.loadTopLiked();
      !active && this.store.dispatch(appStateActions.setActiveMenuNav({ activeMenuNav: 'main' }));
    }),
  );

  // #1 most-liked item shown on the MOST LIKES menu button.
  topLikedItem = signal<TopLikedItem | null>(null);
  activeMenuNav$ = this.store.select(appStateSelectors.selectActiveMenuNav);
  activeCollection$ = this.store.select(dataStateSelectors.selectActiveCollection);

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
    private likesSvc: LikesService,
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
              targets: this.menuMostLikes?.nativeElement,
              opacity: menuNav === 'mostLikes' ? 1 : 0,
              translateX: menuNav === 'mostLikes' ? '0' : '100%',
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

  private async loadTopLiked(): Promise<void> {
    try {
      const items = await this.likesSvc.topLiked(1);
      this.topLikedItem.set(items[0] ?? null);
    } catch {}
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
