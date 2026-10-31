import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationStart, Router, RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, filter, map } from 'rxjs';

import { GlobalState } from '@/models/global-state';
import { DataService } from '@/services/data.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { ThemeService } from '@/services/theme.service';
import { ReserveLeftOutService, VALUED_AT_TOP_SALE, reservePrice } from '@/services/reserve-left-out.service';
import { FiatPipe } from '@/pipes/fiat.pipe';
import { CollectionLook, liveCollections } from '@/utils/wallet-groups';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

/** the floors, kept a while so page loads and repeat visits don't read the listings again */
const CACHE_KEY = 'reserve-ticker';
const CACHE_MS = 10 * 60_000;
/** crawlers run the page's script too; they get the ticker without its read */
const BOT = /bot|crawl|spider|slurp|bytespider|headless|lighthouse|preview/i;

/**
 * The Phederal Reserve in the header: every live collection's market cap (supply × floor) added up,
 * with a panel underneath (opened from the chip) that breaks it down by collection and links to the full
 * Reserve in the bank. The floors are the bank's own shared read, made once the page is idle and
 * kept ten minutes; sales and holders are read only when the panel first opens.
 */
@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-reserve-ticker',
  templateUrl: './reserve-ticker.component.html',
  styleUrls: ['./reserve-ticker.component.scss'],
})
export class ReserveTickerComponent {
  private dataSvc = inject(DataService);
  private prefs = inject(PhunkPreferencesService);
  private themeSvc = inject(ThemeService);
  private store = inject(Store<GlobalState>);

  open = signal(false);
  floors = signal<Record<string, number> | null>(null);
  sales = signal<{ slug: string; eth: number }[] | null>(null);
  holders = signal<Record<string, number> | null>(null);

  private config = toSignal(this.store.select(appStateSelectors.selectConfig));
  collections = toSignal(combineLatest([
    this.store.select(dataStateSelectors.selectCollections),
    this.store.select(appStateSelectors.selectConfig),
  ]).pipe(map(([c, config]: [any[], any]) =>
    liveCollections(c || [], config?.hiddenSlugs || [], this.themeSvc.collectionOverrides) as CollectionLook[])), { initialValue: [] as CollectionLook[] });

  /** each collection's cap, in the site's own order (the collections menu's); null cap = nothing listed */
  rows = computed(() => {
    const f = this.floors();
    return this.collections()
      .map(c => {
        const price = f ? reservePrice(c.slug, f[c.slug]) : null;
        return { c, floor: f?.[c.slug] ?? null, topSale: VALUED_AT_TOP_SALE[c.slug] ?? null, cap: price && c.supply ? price * c.supply : null };
      });
  });
  /** a row valued at its top sale is on show (so the footnote explains it) */
  pinnedShown = computed(() => this.rows().some(r => r.topSale));
  /** collections left out of the totals (tap a collection's picture), shared with the bank's Reserve */
  private leftOut = inject(ReserveLeftOutService);
  left = this.leftOut.left;
  toggleLeft(slug: string) { this.leftOut.toggle(slug); }

  total = computed(() => this.floors()
    ? this.rows().reduce((n, r) => n + (this.left().has(r.c.slug) ? 0 : r.cap ?? 0), 0) : null);

  volume = computed(() => {
    const s = this.sales(); if (!s) return null;
    const live = new Set(this.collections().map(c => c.slug).filter(slug => !this.left().has(slug)));
    const mine = s.filter(x => live.has(x.slug));
    return { n: mine.length, eth: mine.reduce((v, x) => v + x.eth, 0) };
  });

  private usd = toSignal(this.store.select(dataStateSelectors.selectDisplayUsd));
  private fiatPipe = new FiatPipe(this.prefs);

  constructor() {
    this.readCache();
    if (!this.floors() && !(typeof navigator !== 'undefined' && (navigator.webdriver || BOT.test(navigator.userAgent)))) {
      // after the page has settled, so the header never holds up the page itself
      const go = () => this.loadFloors();
      setTimeout(() => ('requestIdleCallback' in window ? (window as any).requestIdleCallback(go, { timeout: 4000 }) : go()), 1500);
    }
    // a page change closes the panel
    inject(Router).events.pipe(filter(e => e instanceof NavigationStart)).subscribe(() => this.open.set(false));
  }

  private readCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && Date.now() - c.at < CACHE_MS && c.floors) this.floors.set(c.floors);
    } catch { /* storage blocked: read live */ }
  }

  private async loadFloors() {
    try {
      const st = await this.dataSvc.fetchFloorStats();
      this.floors.set(st.floors);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), floors: st.floors })); } catch {}
    } catch { /* the chip just keeps its "…" */ }
  }

  private extrasAsked = false;
  private loadExtras() {
    if (this.extrasAsked) return;
    this.extrasAsked = true;
    if (!this.floors()) this.loadFloors();
    this.dataSvc.fetchAllSales().then(s => this.sales.set(s)).catch(() => {});
    this.dataSvc.fetchHolders(this.config()?.hiddenSlugs || []).then(h => this.holders.set(h)).catch(() => {});
  }

  show() { this.loadExtras(); this.open.set(true); }
  /** opens and closes on the chip only (no hover), so it stays put while you read it */
  toggle() { this.open() ? this.open.set(false) : this.show(); }

  @HostListener('document:keydown.escape') esc() { this.open.set(false); }
  @HostListener('document:click', ['$event']) outside(e: Event) {
    if (this.open() && !(e.target as HTMLElement).closest?.('app-reserve-ticker')) this.open.set(false);
  }

  /** Ξ amounts, sign included: whole numbers once big, a few decimals when small; "—" with no floor */
  eth(v: number | null | undefined): string {
    if (v === null || v === undefined) return this.floors() ? '—' : '…';
    return 'Ξ' + v.toLocaleString('en-US', { maximumFractionDigits: v >= 1000 ? 0 : v >= 10 ? 1 : 3 });
  }
  fiat(v: number | null | undefined): string {
    const rate = Number(this.usd());
    return v && rate ? this.fiatPipe.transform(v * rate, 'short') : '';
  }

  t(key: string, params?: Record<string, string | number>) {
    return this.prefs.t(key, params);
  }
}
