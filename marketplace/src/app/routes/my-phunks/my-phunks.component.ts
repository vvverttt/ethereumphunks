import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { combineLatest, from, map, of, shareReplay, switchMap } from 'rxjs';

import { GlobalState } from '@/models/global-state';
import { Phunk } from '@/models/db';

import { DataService } from '@/services/data.service';
import { ThemeService } from '@/services/theme.service';
import { Web3Service } from '@/services/web3.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

import { PhunkImageComponent } from '@/components/phunk-image/phunk-image.component';
import { TokenNumberPipe } from '@/pipes/token-number.pipe';
import { detailsLink, groupWalletItems, liveCollections, WalletGroup } from '@/utils/wallet-groups';

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
  imports: [CommonModule, RouterModule, PhunkImageComponent, TokenNumberPipe],
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

  detailsLink = detailsLink;

  connected$ = this.store.select(appStateSelectors.selectWalletAddress).pipe(map(a => a?.toLowerCase() || null));

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
  shelf$ = this.address$.pipe(
    switchMap(address => address
      ? combineLatest([
          from(this.dataSvc.fetchOwnedAllCollections(address)),
          this.store.select(dataStateSelectors.selectCollections),
          this.store.select(marketStateSelectors.selectOwned),
          this.store.select(appStateSelectors.selectConfig),
        ]).pipe(map(([items, collections, ownedHere, config]: [Phunk[], any[], Phunk[] | null, any]) => {
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
          return { address, owned, all };
        }))
      : of(null)),
  );

  /** collections not held yet stay hidden until the switch is on (unless nothing is held) */
  showMissing = signal(false);

  copied = signal(false);

  async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1200);
    } catch {}
  }

  total(groups: WalletGroup[]) {
    return groups.reduce((n, g) => n + g.items.length, 0);
  }

  short(address: string) {
    return address.slice(0, 6) + '…' + address.slice(-4);
  }

  /** share of a collection's supply, one decimal under 10% */
  share(held: number, supply: number) {
    if (!supply) return '';
    const pct = held / supply * 100;
    if (pct < .1) return '<0.1%';
    return (pct < 10 ? pct.toFixed(1) : Math.round(pct)) + '%';
  }

  jumpTo(slug: string) {
    // after a render, so a row the switch just revealed exists
    setTimeout(() => document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  connect() {
    this.web3Svc.connect();
  }

  t(key: string, params?: Record<string, string | number>) {
    return this.prefs.t(key, params);
  }
}
