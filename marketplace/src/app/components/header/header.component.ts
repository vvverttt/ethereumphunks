import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';

import { MenuComponent } from '@/components/menu/menu.component';
import { SearchComponent } from '@/components/search/search.component';
import { CollectionsDropdownComponent } from '@/components/collections-dropdown/collections-dropdown.component';

import { Web3Service } from '@/services/web3.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { ThemeService } from '@/services/theme.service';

import { Subject, combineLatest, firstValueFrom, map, tap, withLatestFrom } from 'rxjs';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';

import { GlobalState } from '@/models/global-state';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as notificationSelectors from '@/state/selectors/notification.selectors';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import * as appStateActions from '@/state/actions/app-state.actions';

import { environment } from '@/../environments/environment';
import { LazyLoadImageModule } from 'ng-lazyload-image';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LazyLoadImageModule,

    SearchComponent,
    CollectionsDropdownComponent,

    WalletAddressDirective,
  ],
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  host: { '[class.panel-open]': 'panelOpen()' },
})

export class HeaderComponent {

  connected$ = this.store.select(appStateSelectors.selectConnected);
  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  hasWithdrawal$ = this.store.select(appStateSelectors.selectHasWithdrawal);
  userPoints$ = this.store.select(appStateSelectors.selectUserPoints);
  activeMultiplier$ = this.store.select(appStateSelectors.selectActiveMultiplier);
  activeCollection$ = this.store.select(dataStateSelectors.selectActiveCollection);
  menuActive$ = this.store.select(appStateSelectors.selectMenuActive);
  theme$ = this.store.select(appStateSelectors.selectTheme);
  notifications$ = this.store.select(notificationSelectors.selectNotifications).pipe(
    map((res) => res.filter((tx) => !tx.dismissed && tx.isNotification).length),
  );

  // The menu or the market's side panel is open: the header drops its own background so the
  // panel shows through behind its buttons, as it always has (see header.component.scss).
  panelOpen = toSignal(combineLatest([
    this.menuActive$,
    this.store.select(appStateSelectors.selectSlideoutActive),
  ]).pipe(map(([menu, slideout]) => !!menu || !!slideout)), { initialValue: false });

  toggleTheme$ = new Subject<void>();
  toggleMenu$ = new Subject<void>();

  // Collections with a two-colour logo of their own (assets/etherphunks-logo-<slug>.svg).
  readonly themedLogos = new Set(['ethsrocks', 'missing-phunks', 'dysto-phunks', 'phikings', 'phunklloween']);

  isStandaloneMarket = environment.standalone;
  defaultCollection = environment.defaultCollection || 'cryptophunksv67';

  async openDystolabz(event: Event): Promise<void> {
    event.stopPropagation();
    event.preventDefault();
    const isIPhone = /iPhone/i.test(navigator.userAgent);
    const connected = await firstValueFrom(this.connected$);
    if (isIPhone && connected) {
      this.router.navigate(['/']);
    } else {
      window.open('https://dystolabz.com', '_blank', 'noopener,noreferrer');
    }
  }

  constructor(
    private store: Store<GlobalState>,
    private router: Router,
    public web3Svc: Web3Service,
    public preferences: PhunkPreferencesService,
    public themeSvc: ThemeService,
  ) {
    this.toggleTheme$.pipe(
      withLatestFrom(this.theme$),
      tap(([click, theme]) => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        this.store.dispatch(appStateActions.setTheme({ theme: newTheme }));
      }),
    ).subscribe();

    this.toggleMenu$.pipe(
      withLatestFrom(this.menuActive$),
      tap(([click, menuActive]) => {
        // console.log('menuActive', menuActive);
        this.store.dispatch(appStateActions.setMenuActive({ menuActive: !menuActive }));
      })
    ).subscribe();
  }

  t(key: string): string {
    return this.preferences.t(key);
  }
}
