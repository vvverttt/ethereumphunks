import { Component, DestroyRef, inject, isDevMode } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { BehaviorSubject, combineLatest, filter, from, map, of, shareReplay, switchMap } from 'rxjs';

import { GlobalState } from '@/models/global-state';
import { Phunk } from '@/models/db';

import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';
import { Web3Service } from '@/services/web3.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

import { groupWalletItems, liveCollections, WalletGroup } from '@/utils/wallet-groups';
import { PhunkAtmComponent } from '@/components/phunk-atm/phunk-atm.component';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as marketStateSelectors from '@/state/selectors/market-state.selectors';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

/**
 * /my-phunks: every piece the connected wallet holds (or the wallet in `?address=`), grouped by
 * collection in each collection's colours, with a set meter and the collections not held yet.
 * The menu's "Your Phunks" cards are the thumbnail version of this page, and both use the same
 * cached holdings query (refetched only after the wallet's own transactions).
 */
@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, PhunkAtmComponent],
  selector: 'app-my-phunks',
  templateUrl: './my-phunks.component.html',
  styleUrls: ['./my-phunks.component.scss'],
})
export class MyPhunksComponent {
  private store = inject(Store<GlobalState>);
  private dataSvc = inject(DataService);
  private themeSvc = inject(ThemeService);
  private web3Svc = inject(Web3Service);
  private prefs = inject(PhunkPreferencesService);


  // the tab reads "Phleeca Bank" while the bank is open, and goes back to the site's own title after
  private title = inject(Title);
  private siteTitle = this.title.getTitle();
  private setTitle = (this.title.setTitle('Phleeca Bank · ' + this.siteTitle),
    inject(DestroyRef).onDestroy(() => this.title.setTitle(this.siteTitle)));

  /** Local dev only: `?preview=1` with `?address=` shows that wallet as if it were yours, so the
   *  terminal can be looked at without connecting. Ignored in production builds. */
  preview = isDevMode() && new URLSearchParams(location.search).get('preview') === '1';

  connected$ = this.store.select(appStateSelectors.selectWalletAddress).pipe(map(a => {
    const param = new URLSearchParams(location.search).get('address');
    if (this.preview && param) return param.toLowerCase();
    return a?.toLowerCase() || null;
  }));

  /** the wallet shown: `?address=` when given, otherwise the connected one */
  address$ = combineLatest([
    inject(ActivatedRoute).queryParamMap.pipe(map(q => q.get('address'))),
    this.connected$,
  ]).pipe(
    map(([param, wallet]) => (param && /^0x[0-9a-fA-F]{40}$/.test(param) ? param.toLowerCase() : wallet)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  ens$ = this.address$.pipe(switchMap(a => (a ? from(this.web3Svc.getEnsFromAddress(a)) : of(null))));

  /** what the wallet holds, plus every live collection it doesn't hold yet */
  /** bumped after a move at the machine, so the holdings are read again */
  private reload$ = new BehaviorSubject(0);

  shelf$ = combineLatest([this.address$, this.reload$]).pipe(
    map(([address]) => address),
    switchMap(address => address
      ? combineLatest([
          from(this.dataSvc.fetchOwnedAllCollections(address)),
          this.store.select(dataStateSelectors.selectCollections),
          this.store.select(marketStateSelectors.selectOwned),
          this.store.select(appStateSelectors.selectConfig),
        ]).pipe(
          // not before the site's collections are in: without them every wallet looks empty, and the
          // old holdings layout flashed up for a moment on reload before the bank appeared
          filter(([, collections]) => !!(collections as any[])?.length),
          map(([items, collections, ownedHere, config]: [Phunk[], any[], Phunk[] | null, any]) => {
          const hidden = config?.hiddenSlugs || [];
          const overrides = this.themeSvc.collectionOverrides;
          const listed = new Map((ownedHere || []).map(p => [p.hashId, p.listing]));
          const owned = groupWalletItems(items, collections, hidden, overrides, listed);
          // every live collection in the site's order: held ones carry their pieces, the rest a few previews
          const all = liveCollections(collections, hidden, overrides).map(c => {
            const held = owned.find(g => g.slug === c.slug)?.items || [];
            return {
              ...c,
              items: held,
              previews: held.length ? [] : c.previews.slice(0, 6).map(p => ({ ...p, slug: c.slug })),
            };
          });
          // for the bank machine: what's held (site order) and what isn't yet
          const held = all.filter(c => c.items.length) as WalletGroup[];
          const missing = all.filter(c => !c.items.length).map(c => ({ slug: c.slug, name: c.name, logo: c.logo }));
          return { address, owned, all, held, missing };
        }))
      : of(null)),
  );

  /** every live collection, for The Phederal Reserve when no wallet is connected */
  reserve$ = combineLatest([
    this.store.select(dataStateSelectors.selectCollections),
    this.store.select(appStateSelectors.selectConfig),
  ]).pipe(map(([collections, config]: [any[], any]) =>
    liveCollections(collections || [], config?.hiddenSlugs || [], this.themeSvc.collectionOverrides)));

  /** After a move: drop the cached holdings and read them again once the indexer has caught up. */
  refresh(address: string) {
    this.dataSvc.invalidateOwned(address);
    setTimeout(() => { this.dataSvc.invalidateOwned(address); this.reload$.next(this.reload$.value + 1); }, 6000);
  }

  connect() {
    this.web3Svc.connect();
  }

  t(key: string, params?: Record<string, string | number>) {
    return this.prefs.t(key, params);
  }
}
