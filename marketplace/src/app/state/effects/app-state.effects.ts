import { Injectable } from '@angular/core';

import { Store } from '@ngrx/store';
import { ROUTER_NAVIGATION } from '@ngrx/router-store';

import { Actions, createEffect, ofType } from '@ngrx/effects';

import { Web3Service } from '@/services/web3.service';
import { ThemeService } from '@/services/theme.service';
import { DataService } from '@/services/data.service';
import { SocketService } from '@/services/socket.service';

import { GlobalState, LinkedAccount } from '@/models/global-state';

import { catchError, EMPTY, filter, from, map, merge, mergeMap, of, switchMap, take, tap, withLatestFrom } from 'rxjs';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as marketStateActions from '@/state/actions/market-state.actions';
import * as dataStateActions from '@/state/actions/data-state.actions';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import { ChatService } from '@/services/chat.service';

import { environment } from 'src/environments/environment';
import { formatEther } from 'viem';
import { StorageService } from '@/services/storage.service';

// Pages that aren't a collection but always wear one's colours, so arriving from another page
// never carries its colours or logo over. Mirrored in the pre-boot script in index.mainnet.html.
// Collection pages take theirs from the slug (onCollectionThemeSlug$); the auction and item
// pages from the item on screen.
const FIXED_THEME_PAGES: Record<string, string> = {
  phupreme: 'cryptophunksv67',  // Phupreme, its wins and its pool
  lottery: 'cryptophunksv67',   // old Phupreme links, redirected
  owners: 'cryptophunksv67',
  admin: 'cryptophunksv67',
};

// Footer pages carry no collection of their own: they keep the colours of the collection the
// visitor came from (or, on a reload, the last one this browser showed).
const FOOTER_PAGES = ['about', 'shell-archive', 'my-phunks', 'terms', 'license', 'privacy'];

@Injectable()
export class AppStateEffects {

  globalConfig$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.initGlobalConfig),
    switchMap(() => {
      return this.dataSvc.fetchGlobalConfig().pipe(
        switchMap((config) => {
          // Emit config immediately so UI can render, then update with paused status
          const immediate = of(appStateActions.setGlobalConfig({ config }));
          const withPaused = from(this.web3Svc.checkContractPaused()).pipe(
            map((paused) => {
              const newConfig = {
                ...config,
                maintenance: paused || config.maintenance,
              };
              return appStateActions.setGlobalConfig({ config: newConfig });
            }),
            catchError(() => of(appStateActions.setGlobalConfig({ config }))),
          );
          return merge(immediate, withPaused);
        })
      )
    })
  ));

  routerNavigation$ = createEffect(() => this.actions$.pipe(
    ofType(ROUTER_NAVIGATION),
    mergeMap(() => [
      appStateActions.setMenuActive({ menuActive: false }),
      appStateActions.setSlideoutActive({ slideoutActive: false }),
      appStateActions.setActiveMenuNav({ activeMenuNav: 'main' }),
      appStateActions.setCollectionsMenuActive({ collectionsMenuActive: false }),
    ])
  ));

  addressChanged$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setWalletAddress),
    filter(({ walletAddress }) => !!walletAddress),
    mergeMap(({ walletAddress }) => {
      const address = walletAddress?.toLowerCase();
      return [
        appStateActions.fetchUserPoints({ address }),
        appStateActions.checkHasWithdrawal(),
        appStateActions.reconnectChat(),
      ];
    }),
  ));

  checkIsBanned$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setWalletAddress),
    filter((action) => !!action.walletAddress),
    switchMap((action) => this.dataSvc.checkIsBanned(action.walletAddress!)),
    map(isBanned => appStateActions.setIsBanned({ isBanned })),
  ));

  checkHasWithdrawal$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.checkHasWithdrawal),
    withLatestFrom(this.store.select(appStateSelectors.selectWalletAddress)),
    filter(([action, address]) => !!address),
    switchMap(([action, address]) => {
      return from(this.web3Svc.checkHasWithdrawal(address!)).pipe(
        map(hasWithdrawal => Number(formatEther(hasWithdrawal))),
        catchError(() => of(0)),
      );
    }),
    map(hasWithdrawal => appStateActions.setHasWithdrawal({ hasWithdrawal })),
  ));

  fetchUserPoints$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.fetchUserPoints),
    withLatestFrom(this.store.select(appStateSelectors.selectWalletAddress)),
    filter(([action, address]) => !!action.address && action.address === address),
    switchMap(([action, address]) => this.dataSvc.fetchUserPoints(address!)),
    map((userPoints) => appStateActions.setUserPoints({ userPoints }))
  ));

  pointsChanged$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.pointsChanged),
    withLatestFrom(this.store.select(appStateSelectors.selectWalletAddress)),
    filter(([action, address]) => !!action.log?.args?.user && action.log.args.user.toLowerCase() === address),
    map(([action, address]) => appStateActions.fetchUserPoints({ address }))
  ));

  fetchActiveMultiplier$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.fetchActiveMultiplier),
    switchMap(() => from(this.web3Svc.getMultiplier())),
    map((activeMultiplier) => appStateActions.setActiveMultiplier({ activeMultiplier: Number(activeMultiplier) }))
  ));

  menuActive$ = createEffect(() => this.actions$.pipe(
    ofType(
      appStateActions.setMenuActive,
      appStateActions.setTheme
    ),
    withLatestFrom(
      this.store.select(appStateSelectors.selectMenuActive),
      this.store.select(appStateSelectors.selectTheme)
    ),
    tap(([_, menuActive, theme]) => {
      // Effective styles, so a collection's own header colour survives the menu toggling
      // (every navigation closes the menu, which used to repaint the header base pink).
      const activeTheme = this.themeSvc.getEffectiveStyles(theme) as any;
      if (!document.documentElement.style.getPropertyValue('--header-text')) return;
      document.documentElement.style.setProperty(
        '--header-text',
        menuActive ? activeTheme['--header-text-active'] : activeTheme['--header-text']
      );
    }),
  ), { dispatch: false });

  onSetTheme$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setTheme),
    withLatestFrom(this.store.select(appStateSelectors.selectMenuActive)),
    tap(([action, menuActive]) => {
      let theme = action.theme;
      if (theme === 'initial') {
        theme = this.themeSvc.getInitialTheme();
        this.store.dispatch(appStateActions.setTheme({ theme }));
        return;
      }
      this.themeSvc.setThemeStyles(theme);
      // document.documentElement.style.setProperty(
      //   '--header-text',
      //   menuActive ? '255, 255, 255' : (this.themeSvc.themeStyles as any)[theme]['--header-text']
      // );
    }),
  ), { dispatch: false });

  // Re-apply the theme when the active collection changes so per-collection overrides
  // (e.g. cryptophunksv67 -> #648595) take effect; all other collections keep the default.
  onCollectionThemeSlug$ = createEffect(() => this.actions$.pipe(
    ofType(marketStateActions.setMarketSlug),
    tap((action) => this.themeSvc.setActiveCollection((action as any).marketSlug || '')),
  ), { dispatch: false });

  onFixedThemePage$ = createEffect(() => this.actions$.pipe(
    ofType(ROUTER_NAVIGATION),
    map((action: any) => FIXED_THEME_PAGES[String(action.payload.event.urlAfterRedirects).split(/[?#]/)[0].split('/')[1] || '']),
    filter((slug): slug is string => !!slug),
    withLatestFrom(this.store.select(dataStateSelectors.selectCollections)),
    tap(([slug, collections]) => {
      this.themeSvc.setActiveCollection(slug);
      // The header's collection switcher follows the colours too.
      const collection = collections?.find((c) => c.slug === slug);
      if (collection) this.store.dispatch(dataStateActions.setActiveCollection({ activeCollection: { ...collection } }));
    }),
  ), { dispatch: false });

  onFooterPage$ = createEffect(() => this.actions$.pipe(
    ofType(ROUTER_NAVIGATION),
    filter((action: any) => FOOTER_PAGES.includes(String(action.payload.event.urlAfterRedirects).split(/[?#]/)[0].split('/')[1] || '')),
    // the colours already on (from the collection the visitor came from, or restored on a reload)
    map(() => { try { return this.themeSvc.themeSlug() || localStorage.getItem('EtherPhunks_collection') || ''; } catch { return this.themeSvc.themeSlug(); } }),
    // only a real collection: an older build stored the page name itself (e.g. "shell-archive")
    filter((slug) => !!slug && !FOOTER_PAGES.includes(slug)),
    tap((slug) => this.themeSvc.setActiveCollection(slug)),
    // on a reload the collections list arrives a moment later; wait for it for the header switcher
    switchMap((slug) => this.store.select(dataStateSelectors.selectCollections).pipe(
      filter((c) => !!c?.length), take(1), map((collections) => [slug, collections] as const),
    )),
    tap(([slug, collections]) => {
      const collection = collections?.find((c) => c.slug === slug);
      if (collection) this.store.dispatch(dataStateActions.setActiveCollection({ activeCollection: { ...collection } }));
    }),
  ), { dispatch: false });

  onNewBlockCheckCooldown$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setCurrentBlock),
    withLatestFrom(this.store.select(appStateSelectors.selectCooldowns)),
    map(([action, cooldowns]) => {
      let cooldownsCopy = { ...cooldowns };
      Object.keys(cooldowns).forEach(hashId => {
        if (action.currentBlock >= (cooldowns[hashId] + this.web3Svc.maxCooldown)) {
          delete cooldownsCopy[hashId];
        }
      });
      return appStateActions.setCooldowns({ cooldowns: cooldownsCopy });
    })
  ));

  onMouseDown$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.mouseDown),
    withLatestFrom(
      this.store.select(appStateSelectors.selectMenuActive),
      this.store.select(appStateSelectors.selectSlideoutActive),
      this.store.select(appStateSelectors.selectSearchHistoryActive),
    ),
    tap(([action, menuActive, slideoutActive, searchHistoryActive]) => {

      const slideout = document.querySelector('app-slideout') as HTMLElement;
      const menu = document.querySelector('app-menu') as HTMLElement;
      const header = document.querySelector('app-header') as HTMLElement;
      const search = document.querySelector('app-search') as HTMLElement;
      const collectionsMenu = document.querySelector('app-collections-dropdown') as HTMLElement;
      const target = action.event.target as HTMLElement;

      if (
        menuActive
        && !menu?.contains(target)
        && !header.contains(target)
      ) {
        this.store.dispatch(appStateActions.setMenuActive({ menuActive: false }));
      }

      if (
        slideoutActive
        && !slideout?.contains(target)
      ) {
        this.store.dispatch(appStateActions.setSlideoutActive({ slideoutActive: false }));
      }

      if (
        searchHistoryActive &&
        !search?.contains(target)
      ) {
        this.store.dispatch(appStateActions.setSearchHistoryActive({ searchHistoryActive: false }));
      }

      if (
        !collectionsMenu?.contains(target)
      ) {
        this.store.dispatch(appStateActions.setCollectionsMenuActive({ collectionsMenuActive: false }));
      }
    }),
  ), { dispatch: false });

  onSearchHistoryClear = createEffect(() => this.actions$.pipe(
    ofType(
      appStateActions.clearSearchHistory,
      appStateActions.addSearchHistory,
      appStateActions.removeSearchHistory,
    ),
    withLatestFrom(this.store.select(appStateSelectors.selectSearchHistory)),
    map(([action, searchHistory]) => {
      localStorage.setItem(`EtherPhunks_searchHistory_${environment.chainId}`, JSON.stringify(searchHistory));
      return appStateActions.setSearchHistory({ searchHistory });
    })
  ));

  onReconnectChat$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.reconnectChat),
    withLatestFrom(this.store.select(appStateSelectors.selectWalletAddress)),
    filter(([action, address]) => !!address),
    switchMap(([action, address]) => from(this.chatSvc.reconnectXmtp(address!))),
  ), { dispatch: false });

  onSetLinkedAccounts$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setWalletAddress),
    filter(({ walletAddress }) => !!walletAddress),
    switchMap(({ walletAddress }) => {
      return from(this.storageSvc.getItem<LinkedAccount[]>('accounts')).pipe(
        filter((accounts) => !accounts?.find(account => account.address === walletAddress!)),
        map((accounts) => {
          const newLinkedAccounts = [...(accounts || []), { address: walletAddress! }];
          return appStateActions.setLinkedAccounts({ linkedAccounts: newLinkedAccounts });
        }),
        // tap((action) => console.log({ action }))
      );
    }),
  ));

  setLinkedAccounts$ = createEffect(() => this.actions$.pipe(
    ofType(appStateActions.setLinkedAccounts),
    switchMap((action) => {
      return from(this.storageSvc.setItem('accounts', action.linkedAccounts)).pipe(
        tap(() => {
          this.socketSvc.sendMessage('accounts', JSON.stringify(action.linkedAccounts.map(account => account.address)));
        })
      );
    }),
  ), { dispatch: false });

  // closeModal$ = createEffect(() => this.actions$.pipe(
  //   ofType(appStateActions.mouseDown),
  //   withLatestFrom(this.store.select(appStateSelectors.selectModalActive)),
  //   // tap(([action, modalActive]) => console.log({ action, modalActive })),
  //   // map(([action, modalActive]) => appStateActions.setModalActive({ modalActive: !modalActive })),
  // ), { dispatch: false });

  constructor(
    private store: Store<GlobalState>,
    private actions$: Actions,
    private web3Svc: Web3Service,
    private themeSvc: ThemeService,
    private chatSvc: ChatService,
    private dataSvc: DataService,
    private socketSvc: SocketService,
    private storageSvc: StorageService,
  ) {}
}
