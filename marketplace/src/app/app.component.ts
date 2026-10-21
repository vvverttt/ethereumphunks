import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { NavigationEnd, NavigationStart, Router, RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { WaIntersectionObserver } from '@ng-web-apis/intersection-observer';

import { GlobalState } from '@/models/global-state';

import { HeaderComponent } from '@/components/header/header.component';
import { FooterComponent } from '@/components/footer/footer.component';
import { MenuComponent } from '@/components/menu/menu.component';
import { NotificationsComponent } from '@/components/notifications/notifications.component';
import { ModalComponent } from '@/components/modal/modal.component';
import { ChatComponent } from '@/components/chat/chat.component';
import { ConnectDialogComponent } from '@/components/connect-dialog/connect-dialog.component';

import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';
import { PwaUpdateService } from '@/services/pwa-update.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

import { selectChatActive } from '@/state/selectors/chat.selectors';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as dataStateActions from '@/state/actions/data-state.actions';

import { asyncScheduler, fromEvent, debounceTime, distinctUntilChanged, filter, map, observeOn, scan, startWith, tap } from 'rxjs';

import { environment } from 'src/environments/environment';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    WaIntersectionObserver,

    MenuComponent,
    HeaderComponent,
    FooterComponent,
    NotificationsComponent,
    ModalComponent,
    ChatComponent,
    ConnectDialogComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})

export class AppComponent implements OnInit {

  env = environment;

  // The intro popup used to carry a hardcoded "Last site update" date. It went stale
  // the moment anything shipped without someone remembering to bump it, and a wrong
  // date is worse than none — it made a fresh deploy look like an old one. The footer
  // already shows the real build date, stamped by prebuild on every build.

  chatActive$ = this.store.select(selectChatActive).pipe(map(({ active }) => active));

  // Intro notice shown on entering the auction house.
  showIntro = signal(false);

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private store: Store<GlobalState>,
    public dataSvc: DataService,
    public web3Svc: Web3Service,
    public themeSvc: ThemeService,
    public preferencesSvc: PhunkPreferencesService,
    private router: Router,
    private pwaUpdateSvc: PwaUpdateService,
  ) {
    this.store.dispatch(appStateActions.setTheme({ theme: 'initial' }));
    this.store.dispatch(appStateActions.initGlobalConfig());
    this.store.dispatch(dataStateActions.fetchCollections());
    this.store.dispatch(appStateActions.fetchActiveMultiplier());
  }

  // Pages (by first URL segment) that show an intro notice on entry. Only the
  // auction house now; the collection notices (V67, EthsRocks, Missing/Dysto)
  // were retired once those collections went live.
  private readonly noticeSlugs = new Set(['auction', 'auction2']);

  dismissIntro(): void {
    this.showIntro.set(false);
  }

  ngOnInit(): void {
    this.router.events.pipe(
      ////////////////////////
      // Scroll restoration //
      ////////////////////////
      filter((event) => event instanceof NavigationStart || event instanceof NavigationEnd),
      scan((acc: any, event: any) => {
        return {
          event,
          positions: {
            ...acc.positions,
            ...(event instanceof NavigationStart ? { [event.id]: window.scrollY } : {}),
          },
          trigger: event instanceof NavigationStart ? event.navigationTrigger : acc.trigger,
          idToRestore: (event instanceof NavigationStart && event.restoredState && event.restoredState.navigationId + 1) || acc.idToRestore,
        };
      }),
      filter(({ event, trigger }) => event instanceof NavigationEnd && !!trigger),
      observeOn(asyncScheduler),
      tap(({ trigger, positions, idToRestore }) => {
        setTimeout(() => {
          if (trigger === 'imperative') window.scrollTo(0, 0);
          if (trigger === 'popstate') window.scrollTo(0, positions[idToRestore] || 0);
        }, 0);
      })
    ).subscribe();

    fromEvent(this.document, 'mouseup').pipe(
      tap(($event: Event) => {
        $event.stopPropagation();
        this.store.dispatch(appStateActions.mouseUp({ event: $event as MouseEvent }));
      })
    ).subscribe();

    fromEvent(this.document, 'mousedown').pipe(
      tap(($event: Event) => {
        $event.stopPropagation();
        this.store.dispatch(appStateActions.mouseDown({ event: $event as MouseEvent }));
      })
    ).subscribe();

    fromEvent(window, 'resize').pipe(
      debounceTime(100),
      tap(() => this.setIsMobile())
    ).subscribe();

    this.setIsMobile();
    this.pwaUpdateSvc.checkForUpdate();

    // Intro notice: driven by the actual ROUTE, not the global activeCollection
    // (which defaults to cryptophunksv67 and leaks onto pages like /auction).
    // The collection page URL is always `/{slug}` or `/{slug}/market/...` after
    // the initial-collection guard redirects, so the first path segment is the
    // collection slug. Show the notice only when that segment is a notice
    // collection; hide it on any other page (auction, details, lottery, etc.).
    // distinctUntilChanged on the segment means each re-entry re-shows it.
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
      map((url) => url.split(/[?#]/)[0].split('/').filter(Boolean)[0] || ''),
      distinctUntilChanged(),
    ).subscribe((firstSegment: string) => {
      if (this.noticeSlugs.has(firstSegment)) {
        this.showIntro.set(true);
      } else {
        // Left the auction house — make sure its notice doesn't linger.
        this.showIntro.set(false);
      }
    });
  }

  setIsMobile(): void {
    this.store.dispatch(appStateActions.setIsMobile({ isMobile: window.innerWidth < 801 }))
  }
}
