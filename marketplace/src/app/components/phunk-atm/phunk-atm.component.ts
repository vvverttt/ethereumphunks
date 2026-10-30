import { Component, DestroyRef, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { formatEther } from 'viem';

import { GlobalState } from '@/models/global-state';
import { Phunk } from '@/models/db';
import { CollectionLook, WalletGroup, detailsLink } from '@/utils/wallet-groups';
import { PHLEECA_FINE_PRINT, PHLEECA_SELL_SHAME } from '@/utils/phleeca-fine-print';
import { finePrintLine, sellShameLine } from '@/utils/phleeca-fine-print.i18n';
import { isErc721c } from '@/constants/erc721c';

import { OwnerAction, OwnerActionsService } from '@/services/owner-actions.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';

import { PhunkImageComponent } from '@/components/phunk-image/phunk-image.component';
import { FiatPipe } from '@/pipes/fiat.pipe';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import { toSignal } from '@angular/core/rxjs-interop';
import { TokenNumberPipe } from '@/pipes/token-number.pipe';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import { environment } from 'src/environments/environment';

/** home → collections → pieces → piece → (sell | transfer | confirm) → working → done / error,
 *  plus the balance and funds screens off the home menu. */
type Screen = 'home' | 'collections' | 'reserve' | 'statement' | 'pieces' | 'piece' | 'many' | 'sell' | 'transfer' | 'confirm'
  | 'balance' | 'funds' | 'log' | 'working' | 'done' | 'error';
type Funds = { market: string; kind: 'etherphunks' | 'quantumphunks'; wei: bigint }[];
/** a live collection not held yet, for "Start collecting" */
type Missing = { slug: string; name: string; logo?: string | null };

/**
 * The Account Details bank machine: Fleeca's layout in Maze Bank's dress. Everything for your own
 * wallet happens inside it like a real ATM: a home menu (collectibles, balance, withdraw funds,
 * start collecting), your collections, the pieces in one, and each piece's moves, which run right
 * here through OwnerActionsService (the item page's own flows). Only Bids opens the item page,
 * where a bid's extra checks live.
 */
@Component({
  selector: 'app-phunk-atm',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PhunkImageComponent, TokenNumberPipe],
  templateUrl: './phunk-atm.component.html',
  styleUrls: ['./phunk-atm.component.scss'],
})
export class PhunkAtmComponent implements OnChanges {
  private actions = inject(OwnerActionsService);
  private prefs = inject(PhunkPreferencesService);
  private web3Svc = inject(Web3Service);
  private store = inject(Store<GlobalState>);
  private dataSvc = inject(DataService);

  /**
   * The joke fine print along the bottom, a new line every 12 seconds. Dealt like a shuffled deck:
   * every line shows once before any comes round again, and the place in the deck is kept in this
   * browser, so coming back to the bank carries on instead of starting over.
   */
  private finePrintAt = signal(this.nextFinePrint());
  /** the line on screen, in the current language (a language switch swaps it straight away) */
  finePrint = computed(() => finePrintLine(this.prefs.currentLanguage(), this.finePrintAt()));
  private finePrintTimer = setInterval(() => this.finePrintAt.set(this.nextFinePrint()), 12000);
  private stopFinePrint = inject(DestroyRef).onDestroy(() => clearInterval(this.finePrintTimer));

  /** the next line's place in the deck */
  private nextFinePrint(): number {
    const n = PHLEECA_FINE_PRINT.length;
    let deck: { order: number[]; at: number } | null = null;
    try { deck = JSON.parse(localStorage.getItem('phleeca-fine-print') || 'null'); } catch {}
    // a fresh shuffle when there's none yet, it's used up, or the list changed size
    if (!deck || deck.order?.length !== n || deck.at >= n) {
      const last = deck?.order?.[n - 1];
      const order = [...Array(n).keys()];
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      // the new round never opens with the line the last round ended on
      if (order[0] === last && n > 1) [order[0], order[1]] = [order[1], order[0]];
      deck = { order, at: 0 };
    }
    const at = deck.order[deck.at];
    deck.at++;
    try { localStorage.setItem('phleeca-fine-print', JSON.stringify(deck)); } catch {}
    return at;
  }

  /** the collections the wallet holds, in the site's order, with their pieces */
  @Input() groups: WalletGroup[] = [];
  /** every live collection, for The Phederal Reserve's market caps */
  @Input() reserve: CollectionLook[] = [];
  /** live collections the wallet doesn't hold yet */
  @Input() missing: Missing[] = [];
  /** the wallet on the page, for its balance in the market contracts */
  @Input() wallet: string | null = null;
  /** the wallet's ENS name, when it has one */
  @Input() ens: string | null = null;
  /** Local preview of someone else's wallet: everything works except sending. */
  @Input() preview = false;
  /** A move went through: the page refreshes the holdings. */
  @Output() changed = new EventEmitter<void>();
  /** Signed out, Connect was pressed: the page opens the wallet picker. */
  @Output() connectWallet = new EventEmitter<void>();

  readonly detailsLink = detailsLink;
  readonly keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

  screen = signal<Screen>('home');
  group = signal<WalletGroup | null>(null);
  piece = signal<Phunk | null>(null);
  pending = signal<OwnerAction | null>(null);
  amount = signal('');
  recipient = '';
  error = signal('');
  /** the error screen's title: a real failure, or the preview's "connect your own wallet" */
  errorTitle = signal('atmFailed');
  txHash = signal('');
  /** where Back / Done returns to after a transaction */
  private after: Screen = 'home';

  /** ETH the wallet can withdraw from the market contracts (sales, refunds), per contract. */
  funds = signal<Funds | null>(null);
  /** the wallet's own ETH, shown as the account balance */
  walletEth = signal<string | null>(null);
  /** a balance that couldn't be read after the retries: shown as "—", never as 0 */
  fundsFailed = signal(false);
  walletFailed = signal(false);
  /** the transaction log, read when its screen opens */
  log = signal<any[] | null>(null);
  private fundsFor = '';

  ngOnChanges(ch: SimpleChanges) {
    if (this.wallet && this.wallet !== this.fundsFor) { this.loadFunds(); this.loadWalletEth(); this.log.set(null); }
    if (this.wallet && !this.floorsAsked) { this.floorsAsked = true; this.loadFloors(); }
    // holdings refreshed after a move: keep the open collection and piece, with their new state
    if (ch['groups']) {
      const g = this.group();
      if (g) {
        const ng = this.groups.find(x => x.slug === g.slug) || null;
        this.group.set(ng);
        const p = this.piece();
        if (p) this.piece.set(ng?.items.find(i => i.hashId === p.hashId) || null);
      }
    }
  }

  // ---- navigation

  go(s: Screen) {
    this.error.set('');
    // the bank's own screens (menu, collections list, balance, log) drop back to the site colour
    if (s === 'home' || s === 'collections' || s === 'reserve' || s === 'statement' || s === 'balance' || s === 'funds' || s === 'log') this.inCollection.set(false);
    // each visit to the sell screen draws its own lines of shame, should the price go low
    if (s === 'sell') this.shameSeed.set(Math.floor(Math.random() * 1e6));
    // signed out, the floors are only read once The Phederal Reserve is opened
    if (s === 'reserve' && !this.floorsAsked) { this.floorsAsked = true; this.loadFloors(); }
    if (s === 'reserve' && !this.sales()) this.loadSales();
    if (s === 'reserve' && !this.holders()) this.loadHolders();
    this.screen.set(s);
  }

  /** picks this visit's line in each shame level, so a line holds still while the price is typed */
  shameSeed = signal(0);

  /**
   * Sell shame for the lowest price typed (one piece's amount, or the lowest of several): the
   * level and line, worse the lower it goes, or null at Ξ0.067 and up.
   */
  shame(): { level: number; line: string } | null {
    const typed = (this.many() ? this.targets('sell').map(p => this.prices()[p.hashId] || '') : [this.amount()])
      .map(v => parseFloat(v)).filter(n => n > 0);
    if (!typed.length) return null;
    const low = Math.min(...typed);
    const ti = PHLEECA_SELL_SHAME.findIndex(t => low < t.below);
    if (ti < 0) return null;
    return { level: PHLEECA_SELL_SHAME[ti].level, line: sellShameLine(this.prefs.currentLanguage(), ti, this.shameSeed()) };
  }

  /** inside a collection (its pieces and their moves): the bank takes that collection's colour */
  inCollection = signal(false);

  /** the colour on screen: the open collection's while inside it, otherwise the site's own */
  accent(): string | null { return this.inCollection() ? this.group()?.accent || null : null; }

  // the footer's Phupreme badge (outside this component) follows the same colour on the bank page:
  // shared as --bank-accent on the page root, cleared when back on the site colour or leaving
  private shareAccent = effect(() => {
    const a = this.accent();
    if (a) document.documentElement.style.setProperty('--bank-accent', a);
    else document.documentElement.style.removeProperty('--bank-accent');
  });
  private clearAccent = inject(DestroyRef).onDestroy(() => document.documentElement.style.removeProperty('--bank-accent'));

  openGroup(g: WalletGroup) {
    this.group.set(g);
    this.inCollection.set(true);
    this.go('pieces');
  }

  openPiece(p: Phunk) {
    if (this.picking()) return this.togglePick(p);
    this.many.set(null);
    this.piece.set(p);
    this.go('piece');
  }

  // ---- several pieces at once

  /** "Select several" on the pieces screen: a tap ticks a piece instead of opening it */
  picking = signal(false);
  picked = signal<Set<string>>(new Set());
  /** the ticked pieces being acted on, once "Continue" is pressed; null for a single piece */
  many = signal<Phunk[] | null>(null);

  /** several pieces' prices, by hashId, as typed; "Same price for all" fills every one */
  prices = signal<Record<string, string>>({});
  allPrice = '';

  setPrice(hashId: string, v: string) {
    this.prices.set({ ...this.prices(), [hashId]: this.cleanPrice(v) });
  }

  setAllPrices(v: string) {
    this.allPrice = this.cleanPrice(v);
    this.prices.set(Object.fromEntries(this.targets('sell').map(p => [p.hashId, this.allPrice])));
  }

  /** digits and one dot only */
  private cleanPrice(v: string): string {
    const s = (v || '').replace(',', '.').replace(/[^0-9.]/g, '');
    const i = s.indexOf('.');
    return (i < 0 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '')).slice(0, 12);
  }

  /** the total asked for the pieces being listed */
  pricesTotal(): string {
    const n = this.targets('sell').reduce((t, p) => t + (Number(this.prices()[p.hashId]) || 0), 0);
    return this.short(String(n));
  }

  startPicking() { this.picking.set(true); this.picked.set(new Set()); }
  stopPicking() { this.picking.set(false); this.picked.set(new Set()); this.many.set(null); }

  togglePick(p: Phunk) {
    const s = new Set(this.picked());
    s.has(p.hashId) ? s.delete(p.hashId) : s.add(p.hashId);
    this.picked.set(s);
  }

  pickAll() {
    const g = this.group();
    const all = g?.items.map(i => i.hashId) || [];
    this.picked.set(this.picked().size === all.length ? new Set() : new Set(all));
  }

  pickedPieces(): Phunk[] {
    const s = this.picked();
    return (this.group()?.items || []).filter(i => s.has(i.hashId));
  }

  openMany() {
    const ps = this.pickedPieces();
    if (!ps.length) return;
    this.many.set(ps);
    this.pending.set(null);
    this.prices.set({});
    this.allPrice = '';
    this.go('many');
  }

  /** which of the ticked pieces a move applies to, by the same rules as one piece's menu */
  targets(action: OwnerAction, ps: Phunk[] = this.many() || []): Phunk[] {
    const qp = (p: Phunk) => isErc721c(p.slug);
    switch (action) {
      case 'sell': return ps.filter(p => !p.listing);
      case 'delist': return ps.filter(p => !!p.listing);
      case 'escrow': return ps.filter(p => !qp(p) && !p.isEscrowed && !p.listing);
      case 'withdraw': return ps.filter(p => !qp(p) && p.isEscrowed);
      // an Ethscription in escrow has to be withdrawn before it can be sent
      case 'transfer': return ps.filter(p => qp(p) || !p.isEscrowed);
    }
  }

  /** the several-pieces menu: each move with how many of the ticked pieces it covers */
  manyOptions(): { action: OwnerAction; label: string; n: number; main?: boolean }[] {
    const ps = this.many() || [];
    const qp = isErc721c(ps[0]?.slug);
    const all: { action: OwnerAction; label: string; main?: boolean }[] = [
      { action: 'sell', label: 'atmSell', main: true },
      { action: 'delist', label: 'atmDelist' },
      ...(qp ? [] : [{ action: 'escrow' as OwnerAction, label: 'atmEscrowOnly' }, { action: 'withdraw' as OwnerAction, label: 'atmWithdraw' }]),
      { action: 'transfer', label: 'atmTransfer' },
    ];
    return all.map(o => ({ ...o, n: this.targets(o.action, ps).length })).filter(o => o.n > 0);
  }

  /** a several-pieces move needs one wallet prompt per piece on QuantumPhunks and for delists */
  manyOneByOne(action: OwnerAction | null): boolean {
    const ps = this.many() || [];
    return !!action && (isErc721c(ps[0]?.slug) || action === 'delist');
  }

  back() {
    const s = this.screen();
    if (s === 'statement') return this.go('collections');
    if (s === 'collections' || s === 'reserve' || s === 'balance' || s === 'log') return this.go('home');
    if (s === 'pieces') { this.stopPicking(); return this.go('collections'); }
    if (s === 'piece' || s === 'many') return this.go('pieces');
    if (s === 'sell' || s === 'transfer' || s === 'confirm') { this.amount.set(''); this.recipient = ''; if (this.many()) this.pending.set(null); return this.go(this.many() ? 'many' : 'piece'); }
    if (s === 'funds') return this.go('balance');
    if (s === 'done' || s === 'error') return this.go(this.after);
    this.go('home');
  }


  copied = signal(false);

  async copyAddress() {
    if (!this.wallet) return;
    try {
      await navigator.clipboard.writeText(this.wallet);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1200);
    } catch {}
  }

  shortAddress(): string {
    const w = this.wallet || '';
    return w.slice(0, 6) + '…' + w.slice(-4);
  }

  /** the connected wallet, to tell your own account ("My collectibles") from someone else's */
  private me = toSignal(this.store.select(appStateSelectors.selectWalletAddress));
  collectiblesLabel(): string {
    const own = !!this.me() && this.me()!.toLowerCase() === (this.wallet || '').toLowerCase();
    return this.t(own ? 'atmMyCollectibles' : 'atmCollectibles');
  }

  totalPieces(): number {
    return this.groups.reduce((n, g) => n + g.items.length, 0);
  }

  // ---- collectibles value, by floor

  /** each collection's floor (cheapest live listing), read once; null until it answers */
  floors = signal<Record<string, number> | null>(null);
  floorsFailed = signal(false);
  private floorsAsked = false;

  async loadFloors() {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { const st = await this.dataSvc.fetchFloorStats(); this.floors.set(st.floors); this.listed.set(st.listed); this.avgListed.set(st.avgListed); this.floorsFailed.set(false); return; }
      catch { await new Promise(r => setTimeout(r, 3000)); }
    }
    this.floorsFailed.set(true);
  }

  /** a collection's value: pieces held × its floor; null when nothing in it is listed */
  groupValue(g: WalletGroup): number | null {
    const f = this.floors()?.[g.slug];
    return f ? f * g.items.length : null;
  }

  /** the value as shown: "…" while reading, "—" when there's no floor or the read failed */
  valueShown(v: number | null): string {
    if (!this.floors()) return this.floorsFailed() ? '—' : '…';
    // thousands separated, so a big floor (a Ξ8,008,135 rock) still reads at a glance
    return v === null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: v >= 1000 ? 0 : 4 });
  }

  /** The Phederal Reserve: a collection's market cap, its supply × its floor; null with no floor */
  marketCap(c: CollectionLook): number | null {
    const f = this.floors()?.[c.slug];
    return f && c.supply ? f * c.supply : null;
  }

  /** every collection, in the site's own order (as in the collections menu) */
  reserveRows(): CollectionLook[] {
    return this.reserve;
  }

  /** how many pieces each collection has listed, from the same read as the floors */
  listed = signal<Record<string, number>>({});
  /** the average asking price of each collection's listings */
  avgListed = signal<Record<string, number>>({});

  /** a collection's recorded sales and their total, from the sales the chart reads */
  salesOf(slug: string): { n: number; volume: number } | null {
    const all = this.sales();
    if (!all) return null;
    const mine = all.filter(s => s.slug === slug);
    return { n: mine.length, volume: mine.reduce((v, s) => v + s.eth, 0) };
  }

  /** every collection's sales together, for the Reserve's summary */
  salesTotal(): { n: number; volume: number } | null {
    const all = this.sales();
    if (!all) return null;
    const live = new Set(this.reserve.map(c => c.slug));
    const mine = all.filter(s => live.has(s.slug));
    return { n: mine.length, volume: mine.reduce((v, s) => v + s.eth, 0) };
  }

  // ---- the language's currency beside Ξ amounts (en USD, es MXN, ja JPY, zh CNY, id IDR)

  /** the price of 1 ETH in the current language's currency (follows a language switch) */
  private ethFiat = toSignal(this.store.select(dataStateSelectors.selectDisplayUsd));
  private fiatPipe = new FiatPipe(this.prefs);

  /** an ETH amount in the language's currency, short ($5.73K, ¥374K, Rp43M); '' when unknown */
  fiat(eth: number | string | null | undefined): string {
    const n = typeof eth === 'string' ? parseFloat(eth) : eth;
    const rate = Number(this.ethFiat());
    if (n === null || n === undefined || isNaN(n as number) || !rate) return '';
    return this.fiatPipe.transform((n as number) * rate, 'short');
  }

  /** unique holders per collection and across all ('*'): null while reading or unavailable */
  holders = signal<Record<string, number> | null>(null);

  async loadHolders() {
    try {
      const config: any = await firstValueFrom(this.store.select(appStateSelectors.selectConfig));
      this.holders.set(await this.dataSvc.fetchHolders(config?.hiddenSlugs || []));
    } catch { /* the function isn't there yet, or the read failed: holders show "—" */ }
  }

  /** every sale, for the Reserve's sales and volume: null while reading */
  sales = signal<{ slug: string; eth: number; at: number }[] | null>(null);
  salesFailed = signal(false);

  async loadSales() {
    this.salesFailed.set(false);
    try { this.sales.set(await this.dataSvc.fetchAllSales()); }
    catch { this.salesFailed.set(true); }
  }

  /** all the market caps together */
  reserveTotal(): number | null {
    if (!this.floors()) return null;
    return this.reserve.reduce((n, c) => n + (this.marketCap(c) ?? 0), 0);
  }

  /** everything held, by floor; collections with nothing listed add nothing */
  totalValue(): number | null {
    if (!this.floors()) return null;
    return this.groups.reduce((n, g) => n + (this.groupValue(g) ?? 0), 0);
  }

  // ---- a piece's moves

  /** The menu for a piece, by how its collection trades: QuantumPhunks list from the wallet;
   *  Ethscriptions list from escrow (Sell escrows and lists in one go when needed). */
  options(p: Phunk): { action: OwnerAction | 'bids'; label: string; main?: boolean }[] {
    const o: { action: OwnerAction | 'bids'; label: string; main?: boolean }[] = [];
    if (p.listing) o.push({ action: 'delist', label: 'atmDelist' });
    else o.push({ action: 'sell', label: 'atmSell', main: true });
    if (!isErc721c(p.slug)) {
      if (p.isEscrowed) o.push({ action: 'withdraw', label: 'atmWithdraw' });
      else if (!p.listing) o.push({ action: 'escrow', label: 'atmEscrowOnly' });
    }
    o.push({ action: 'transfer', label: 'atmTransfer' });
    o.push({ action: 'bids', label: 'atmBids' });
    return o;
  }

  choose(action: OwnerAction) {
    this.pending.set(action);
    this.go(action === 'sell' ? 'sell' : action === 'transfer' ? 'transfer' : 'confirm');
  }

  press(k: string) {
    const v = this.amount();
    if (k === '⌫') return this.amount.set(v.slice(0, -1));
    if (k === '.' && v.includes('.')) return;
    if (v.length >= 12) return;
    this.amount.set(v === '0' && k !== '.' ? k : v + k);
  }

  listedEth(p: Phunk): string {
    try { return formatEther(BigInt(p.listing?.minValue || '0')); } catch { return ''; }
  }

  confirmText(action: OwnerAction | null): string {
    if (!action) return '';
    return this.many() ? this.t('atmConfirmMany_' + action, { n: this.targets(action).length }) : this.t('atmConfirm_' + action);
  }

  explorer(hash: string) {
    return `${environment.explorerUrl}/tx/${hash}`;
  }

  /** false (with the right screen shown) when this can't send: preview, or no wallet yet */
  private async canSend(): Promise<boolean> {
    if (this.preview) {
      this.errorTitle.set('atmPreviewTitle');
      this.error.set(this.t('atmPreviewOnly'));
      this.screen.set('error');
      return false;
    }
    if (!(await firstValueFrom(this.store.select(appStateSelectors.selectConnected)))) {
      this.web3Svc.connect();
      return false;
    }
    return true;
  }

  private fail(err: any) {
    this.errorTitle.set('atmFailed');
    this.error.set(err?.shortMessage || err?.message || this.t('couldNotProcessTx'));
    this.screen.set('error');
  }

  async confirm() {
    if (this.many()) return this.confirmMany();
    const p = this.piece();
    const action = this.pending();
    if (!p || !action) return;
    if (action === 'sell' && !(Number(this.amount()) > 0)) { this.error.set(this.t('atmEnterAmount')); return; }
    if (action === 'transfer' && !this.recipient.trim()) { this.error.set(this.t('invalidAddress')); return; }
    // a moved piece leaves the wallet, so come back to its collection; otherwise to the piece
    this.after = action === 'transfer' ? 'pieces' : 'piece';
    if (!(await this.canSend())) return;

    this.screen.set('working');
    try {
      const hash =
        action === 'sell' ? await this.actions.sell(p, Number(this.amount())) :
        action === 'delist' ? await this.actions.delist(p) :
        action === 'escrow' ? await this.actions.escrow(p) :
        action === 'withdraw' ? await this.actions.withdraw(p) :
        await this.actions.transfer(p, this.recipient.trim());
      this.txHash.set(hash);
      this.amount.set('');
      this.recipient = '';
      this.screen.set('done');
      this.changed.emit();
    } catch (err) {
      this.fail(err);
    }
  }

  private async confirmMany() {
    const action = this.pending();
    const ps = action ? this.targets(action) : [];
    if (!action || !ps.length) return;
    const prices = ps.map(p => Number(this.prices()[p.hashId]));
    if (action === 'sell' && !prices.every(v => v > 0)) { this.error.set(this.t('atmEnterEachPrice')); return; }
    if (action === 'transfer' && !this.recipient.trim()) { this.error.set(this.t('invalidAddress')); return; }
    this.after = 'pieces';
    if (!(await this.canSend())) return;

    this.screen.set('working');
    try {
      const hash =
        action === 'sell' ? await this.actions.sellMany(ps, prices) :
        action === 'delist' ? await this.actions.delistMany(ps) :
        action === 'escrow' ? await this.actions.escrowMany(ps) :
        action === 'withdraw' ? await this.actions.withdrawMany(ps) :
        await this.actions.transferMany(ps, this.recipient.trim());
      this.txHash.set(hash);
      this.amount.set('');
      this.recipient = '';
      this.prices.set({});
      this.allPrice = '';
      this.stopPicking();
      this.screen.set('done');
      this.changed.emit();
    } catch (err) {
      this.fail(err);
    }
  }

  // ---- balance and funds

  /** Reads each market's balance. A read can hang on a slow RPC (or take ~10s while the client
   *  fails over), so each try gets a generous time limit and a few retries; the strip shows "…" until one answers. */
  async loadFunds() {
    const w = this.wallet;
    if (!w) return;
    this.fundsFor = w;
    for (let attempt = 0; attempt < 4 && this.fundsFor === w; attempt++) {
      try {
        const f = await Promise.race([
          this.web3Svc.fundsByMarket(w),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000)),
        ]);
        if (this.fundsFor === w) { this.funds.set(f); this.fundsFailed.set(false); }
        return;
      } catch {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (this.fundsFor === w) this.fundsFailed.set(true);
  }

  async loadWalletEth() {
    const w = this.wallet;
    if (!w) return;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const wei = await this.web3Svc.getEthBalance(w);
        if (this.wallet === w) { this.walletEth.set(this.short(formatEther(wei))); this.walletFailed.set(false); }
        return;
      } catch {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (this.wallet === w) this.walletFailed.set(true);
  }

  /** the balances as shown: the amount, "…" while reading, "—" if it couldn't be read */
  fundsShown(): string {
    return this.funds() ? this.fundsTotal() : this.fundsFailed() ? '—' : '…';
  }
  walletShown(): string {
    return this.walletEth() ?? (this.walletFailed() ? '—' : '…');
  }

  /** at most 4 decimals, no trailing zeros */
  short(eth: string): string {
    const n = Number(eth);
    return n === 0 ? '0' : (Math.round(n * 1e4) / 1e4).toString();
  }

  /** rows per page of the log; "Load more" fetches the next page only when pressed */
  private readonly LOG_PAGE = 40;
  logHasMore = signal(false);
  logLoading = signal(false);

  // ---- the bank statement: a printed receipt of the account, drawn on a canvas so it can be saved

  private host = inject(ElementRef<HTMLElement>);
  /** the statement as an image (a PNG data URL), drawn when its screen opens */
  statementUrl = signal<string | null>(null);

  /** what the statement shows: the holder's name/address, and the wallet's ETH balance */
  stShowAddress = signal(true);
  stShowBalance = signal(true);

  async toggleStatement(which: 'address' | 'balance') {
    const s = which === 'address' ? this.stShowAddress : this.stShowBalance;
    s.set(!s());
    try { this.statementUrl.set(await this.drawStatement()); } catch { this.statementUrl.set(''); }
  }

  /** the statement opens from My collectibles, and Back returns there */
  async openStatement() {
    this.statementUrl.set(null);
    this.go('statement');
    try { this.statementUrl.set(await this.drawStatement()); } catch { this.statementUrl.set(''); }
  }

  saveStatement() {
    const url = this.statementUrl();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `phleeca-statement-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  }

  // ---- My collectibles, saved as a picture to share: logo, the account bar, the total and a row
  // per collection, drawn on a canvas like the screen (the ₱ side panels included)

  savingView = signal(false);

  /** a screen's rows, as the picture draws them */
  private viewRow = (o: { name: string; accent: string; logo: string | null; badge: string; value: number | null; stats?: string }) => o;

  /** save My collectibles or The Phederal Reserve as a picture */
  async saveView(kind: 'collectibles' | 'reserve') {
    if (this.savingView()) return;
    this.savingView.set(true);
    try {
      const a = document.createElement('a');
      a.href = kind === 'reserve' ? await this.drawReserveView() : await this.drawCollectiblesView();
      a.download = `phleeca-${kind}-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch { /* an image that couldn't be drawn: nothing to save */ }
    this.savingView.set(false);
  }

  private loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise(res => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    });
  }

  private drawCollectiblesView(): Promise<string> {
    return this.drawScreenView({
      total: [this.t('atmValueTotal'), this.totalValue()],
      rows: this.groups.map(g => this.viewRow({ name: g.name, accent: g.accent, logo: g.logo, badge: String(g.items.length), value: this.groupValue(g) })),
    });
  }

  private drawReserveView(): Promise<string> {
    const st = this.salesTotal(), h = this.holders();
    const eth2 = (v: number) => 'Ξ' + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
    const sum = st ? [`${this.t('atmVolume')} ${eth2(st.volume)}`, `${this.t('atmSales')} ${st.n.toLocaleString('en-US')}`,
      ...(st.n ? [`${this.t('atmAvgSale')} Ξ${this.valueShown(st.volume / st.n)}`] : []),
      `${this.t('atmHolders')} ${h?.['*'] != null ? h['*'].toLocaleString('en-US') : '—'}`].join('     ') : '';
    return this.drawScreenView({
      title: this.t('atmReserve'),
      anonymous: true,   // market-wide figures: no address or balances on this one
      total: [this.t('atmReserveTotal'), this.reserveTotal()],
      sum,
      rows: this.reserveRows().map(c => {
        const so = this.salesOf(c.slug);
        const stats = [
          `${this.t('atmFloor')} Ξ${this.valueShown(this.floors()?.[c.slug] ?? null)}`,
          `${this.t('atmHolders')} ${h?.[c.slug] != null ? h[c.slug].toLocaleString('en-US') : '—'}`,
          `${this.t('atmListedCount')} ${this.listed()[c.slug] || 0}`,
          `${this.t('atmAvgListed')} Ξ${this.valueShown(this.avgListed()[c.slug] ?? null)}`,
          ...(so ? [`${this.t('atmSales')} ${so.n}`, `${this.t('atmVolume')} ${eth2(so.volume)}`,
            `${this.t('atmAvgSale')} Ξ${so.n ? this.valueShown(so.volume / so.n) : '—'}`] : []),
        ].join('   ');
        return this.viewRow({ name: c.name, accent: c.accent, logo: c.logo, badge: c.supply.toLocaleString('en-US'), value: this.marketCap(c), stats });
      }),
    });
  }

  /**
   * A bank screen as a picture: the PHLEECA BANK header, the account bar, the ₱ side panels, an
   * optional title, the total bar, an optional summary line, one row per collection (colour
   * stripe, logo, name, optional stats line, badge, value and its fiat), then the fine print on
   * screen and the Phupreme badge, as at the foot of the page.
   */
  private async drawScreenView(spec: {
    title?: string; total: [string, number | null]; sum?: string; anonymous?: boolean;
    rows: { name: string; accent: string; logo: string | null; badge: string; value: number | null; stats?: string }[];
  }): Promise<string> {
    const host = this.host.nativeElement as HTMLElement;
    const cs = getComputedStyle(host);
    const accent = cs.getPropertyValue('--g-accent').trim() || '255, 4, 180';
    const pixel = cs.fontFamily || 'monospace';
    await (document as any).fonts?.ready;
    const W = 1200, side = 150, inner = W - side * 2, gap = 10;
    const rows = spec.rows;
    const rowH = rows.some(r => r.stats) ? 96 : 78;
    const headH = 150, barH = 64;
    // the fine print on screen, wrapped to the screen's width
    const measure = document.createElement('canvas').getContext('2d')!;
    measure.font = `italic 17px Montserrat, sans-serif`;
    const fineLines: string[] = [];
    let cur = '';
    for (const w of this.finePrint().split(' ')) {
      const next = cur ? cur + ' ' + w : w;
      if (measure.measureText(next).width > inner - 80 && cur) { fineLines.push(cur); cur = w; } else cur = next;
    }
    if (cur) fineLines.push(cur);
    const H = headH + barH + 6 + 40 + (spec.title ? 48 : 0) + 64 + (spec.sum ? 44 : 0)
      + rows.length * (rowH + gap) + 30 + fineLines.length * 26 + 40 + 44 + 60;
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    const rootCs = getComputedStyle(document.documentElement);

    // the white bank header with the logo
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, headH);
    const logo = await this.logoImage(accent);
    if (logo) { const lh = 100, lw = logo.width * lh / logo.height; ctx.drawImage(logo, side, (headH - lh) / 2, lw, lh); }

    // the accent bar: who, and the two balances (signed out, or the Reserve: the welcome line)
    let y = headH;
    const bar = ctx.createLinearGradient(0, y, 0, y + barH);
    bar.addColorStop(0, `rgb(${accent})`); bar.addColorStop(1, `rgba(${accent}, .86)`);
    ctx.fillStyle = bar; ctx.fillRect(0, y, W, barH);
    ctx.fillStyle = '#111'; ctx.fillRect(0, y + barH, W, 6);
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
    ctx.font = `18px ${pixel}`; ctx.textAlign = 'left';
    if (this.wallet && !spec.anonymous) {
      ctx.fillText((this.ens || this.shortAddress()).toUpperCase(), side, y + barH / 2);
      ctx.textAlign = 'right';
      ctx.fillText(`${this.t('atmAccountBalance').toUpperCase()} Ξ${this.walletShown()}`, W - side, y + barH / 2 - 11);
      ctx.font = `14px ${pixel}`;
      ctx.fillText(`${this.t('atmCollectiblesBalance').toUpperCase()} Ξ${this.valueShown(this.totalValue())}`, W - side, y + barH / 2 + 13);
    } else {
      ctx.fillText(this.t('atmWelcome').toUpperCase(), side, y + barH / 2);
    }
    y += barH + 6;

    // the screen: ₱ panels down both sides, light grey between
    const bodyBg = getComputedStyle(host.querySelector('.body') as HTMLElement).backgroundImage;
    const tileUrl = /url\("?(.*?)"?\)/.exec(bodyBg)?.[1];
    ctx.fillStyle = '#e3e3e4'; ctx.fillRect(0, y, W, H - y);
    const tile = tileUrl ? await this.loadImage(tileUrl) : null;
    if (tile) { ctx.fillStyle = ctx.createPattern(tile, 'repeat')!; ctx.fillRect(0, y, W, H - y); }
    ctx.fillStyle = '#e9e9ea'; ctx.fillRect(side, y, inner, H - y);

    const px = side + 30, pw = inner - 60;
    y += 40;
    if (spec.title) {
      ctx.fillStyle = '#181a1e'; ctx.font = `22px ${pixel}`; ctx.textAlign = 'center';
      ctx.fillText(spec.title.toUpperCase(), W / 2, y + 14);
      y += 48;
    }
    // the total bar
    ctx.fillStyle = `rgb(${accent})`; ctx.fillRect(px, y, pw, 54);
    ctx.fillStyle = '#fff'; ctx.font = `20px ${pixel}`; ctx.textAlign = 'left';
    ctx.fillText(spec.total[0].toUpperCase(), px + 18, y + 27);
    ctx.textAlign = 'right'; ctx.font = `24px ${pixel}`;
    const fiatTotal = this.fiat(spec.total[1]);
    ctx.fillText(`Ξ${this.valueShown(spec.total[1])}${fiatTotal ? '  ' + fiatTotal : ''}`, px + pw - 18, y + 27);
    y += 54 + 10;
    if (spec.sum) {
      ctx.fillStyle = '#181a1e'; ctx.font = `17px ${pixel}`; ctx.textAlign = 'center';
      ctx.fillText(spec.sum.toUpperCase(), W / 2, y + 16);
      y += 44;
    }

    // a row per collection: colour stripe, logo, name (and stats), badge, value
    const logos = await Promise.all(rows.map(r => r.logo ? this.loadImage(r.logo) : Promise.resolve(null)));
    rows.forEach((r, i) => {
      ctx.fillStyle = '#fff'; ctx.fillRect(px, y, pw, rowH);
      ctx.strokeStyle = '#d0d1d4'; ctx.lineWidth = 1; ctx.strokeRect(px + .5, y + .5, pw - 1, rowH - 1);
      ctx.fillStyle = `rgb(${r.accent})`; ctx.fillRect(px, y, 8, rowH);
      const lg = logos[i];
      if (lg) { ctx.imageSmoothingEnabled = false; ctx.drawImage(lg, px + 28, y + (rowH - 48) / 2, 48, 48); ctx.imageSmoothingEnabled = true; }
      ctx.fillStyle = '#181a1e'; ctx.font = `24px ${pixel}`; ctx.textAlign = 'left';
      ctx.fillText(r.name.toUpperCase(), px + 96, y + rowH / 2 - (r.stats ? 14 : 0));
      if (r.stats) {
        ctx.font = `600 13px Montserrat, sans-serif`; ctx.fillStyle = '#6d7076';
        ctx.fillText(r.stats, px + 96, y + rowH / 2 + 18);
      }
      ctx.font = `18px ${pixel}`;
      const bw = Math.max(44, ctx.measureText(r.badge).width + 20), bx = px + pw - 250;
      ctx.fillStyle = `rgb(${r.accent})`; ctx.fillRect(bx, y + rowH / 2 - 15 - (r.stats ? 14 : 0), bw, 30);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(r.badge, bx + bw / 2, y + rowH / 2 + 1 - (r.stats ? 14 : 0));
      const f = this.fiat(r.value);
      ctx.fillStyle = '#181a1e'; ctx.textAlign = 'right'; ctx.font = `20px ${pixel}`;
      ctx.fillText(`Ξ${this.valueShown(r.value)}`, px + pw - 18, y + rowH / 2 - (f ? 10 : 0) - (r.stats ? 14 : 0));
      if (f) { ctx.font = `600 14px Montserrat, sans-serif`; ctx.fillStyle = '#6d7076'; ctx.fillText(f, px + pw - 18, y + rowH / 2 + 15 - (r.stats ? 14 : 0)); }
      y += rowH + gap;
    });

    // the fine print, then the Phupreme badge in the strip below, as at the foot of the page
    y += 30;
    ctx.font = `italic 17px Montserrat, sans-serif`; ctx.fillStyle = '#6d7076'; ctx.textAlign = 'center';
    for (const l of fineLines) { ctx.fillText(l, W / 2, y + 13); y += 26; }
    y += 40;
    const badge = await this.loadImage('assets/images/phupreme-text.svg');
    if (badge) {
      const bh = 44, bw = badge.width * bh / badge.height;
      ctx.fillStyle = `rgba(${rootCs.getPropertyValue('--bank-accent').trim() || rootCs.getPropertyValue('--pink').trim() || '255, 4, 180'}, 1)`;
      ctx.fillRect((W - bw) / 2, y, bw, bh);
      ctx.drawImage(badge, (W - bw) / 2, y, bw, bh);
    }
    return canvas.toDataURL('image/png');
  }

  /** the PHLEECA BANK logo from the header, as an image with its colours written in */
  private async logoImage(accent: string): Promise<HTMLImageElement | null> {
    const svg = (this.host.nativeElement as HTMLElement).querySelector('svg.logo');
    if (!svg) return null;
    const vb = svg.getAttribute('viewBox')!.split(' ').map(Number);
    let src = svg.outerHTML
      .replace(/class="ink"/g, 'fill="#111111"')
      .replace(/class="acc"/g, `fill="rgb(${accent})"`)
      .replace(/<svg /, `<svg xmlns="http://www.w3.org/2000/svg" width="${vb[2]}" height="${vb[3]}" `);
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    await img.decode();
    return img;
  }

  private async drawStatement(): Promise<string> {
    const W = 640, P = 44, LH = 30;
    const accent = getComputedStyle(this.host.nativeElement as HTMLElement).getPropertyValue('--g-accent').trim() || '255, 4, 180';
    const pixel = getComputedStyle(this.host.nativeElement as HTMLElement).fontFamily || 'monospace';
    await (document as any).fonts?.ready;
    const eth = (v: number | null) => v === null ? '—' : 'Ξ' + this.valueShown(v);
    // the lines, top to bottom: [left, right, style]
    type L = [string, string, ('h' | 'n' | 'b' | 's' | 'rule')?];
    const lines: L[] = [];
    lines.push([this.t('atmStatementTitle').toUpperCase(), '', 'h']);
    lines.push([this.t('atmBranch'), '', 's']);
    lines.push([new Date().toLocaleString(this.prefs.currentLanguage(), { dateStyle: 'medium', timeStyle: 'short' }), '', 's']);
    lines.push(['', '', 'rule']);
    // the holder's name/address and the wallet balance each have a switch, for a shareable slip
    if (this.stShowAddress()) {
      lines.push([this.ens || this.shortAddress(), '', 'b']);
      if (this.ens) lines.push([this.shortAddress(), '', 's']);
      lines.push(['', '', 'rule']);
    }
    if (this.stShowBalance()) {
      lines.push([this.t('atmAccountBalance'), 'Ξ' + this.walletShown()]);
      lines.push(['', '', 'rule']);
    }
    lines.push([this.collectiblesLabel() + ' · ' + this.totalPieces(), '', 'b']);
    for (const g of this.groups) lines.push([`${g.name} ×${g.items.length}`, eth(this.groupValue(g))]);
    lines.push(['', '', 'rule']);
    lines.push([this.t('atmCollectiblesBalance'), eth(this.totalValue()), 'b']);
    const f = this.fiat(this.totalValue());
    if (f) lines.push(['', f, 's']);
    lines.push(['', '', 'rule']);

    const fine = this.finePrint();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    // wrap the fine print to the paper's width
    ctx.font = `italic 15px Montserrat, sans-serif`;
    const words = fine.split(' '), wrapped: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (ctx.measureText(next).width > W - P * 2 && cur) { wrapped.push(cur); cur = w; } else cur = next;
    }
    if (cur) wrapped.push(cur);

    const logoH = 110;
    const H = P + logoH + 24 + lines.length * LH + wrapped.length * 22 + 40 + 34 + 70 + P;
    const scale = 2;
    canvas.width = W * scale; canvas.height = H * scale;
    ctx.scale(scale, scale);

    // the paper, with a torn zigzag bottom edge
    ctx.fillStyle = '#e9e9ea';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fbfaf6';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H - 14);
    for (let x = W; x > 0; x -= 16) { ctx.lineTo(x - 8, H); ctx.lineTo(x - 16, H - 14); }
    ctx.closePath(); ctx.fill();

    let y = P;
    const logo = await this.logoImage(accent);
    if (logo) {
      const lw = logo.width * (logoH / logo.height);
      ctx.drawImage(logo, (W - lw) / 2, y, lw, logoH);
    }
    y += logoH + 24;

    ctx.textBaseline = 'middle';
    for (const [l, r, st] of lines) {
      const mid = y + LH / 2;
      if (st === 'rule') {
        ctx.strokeStyle = '#9a9ea6'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(P, mid); ctx.lineTo(W - P, mid); ctx.stroke(); ctx.setLineDash([]);
      } else {
        const size = st === 'h' ? 22 : st === 's' ? 13 : 16;
        ctx.font = `${size}px ${pixel}`;
        ctx.fillStyle = st === 's' ? '#6d7076' : st === 'h' ? `rgb(${accent})` : '#111';
        if (st === 'h' || (st === 's' && !r)) { ctx.textAlign = 'center'; ctx.fillText(l, W / 2, mid); }
        else {
          ctx.textAlign = 'left'; ctx.fillText(l, P, mid);
          ctx.textAlign = 'right'; ctx.fillText(r, W - P, mid);
        }
      }
      y += LH;
    }
    // the fine print, then the thanks, then a barcode
    y += 10;
    ctx.font = `italic 15px Montserrat, sans-serif`;
    ctx.fillStyle = '#6d7076'; ctx.textAlign = 'center';
    for (const w of wrapped) { ctx.fillText(w, W / 2, y + 11); y += 22; }
    y += 18;
    ctx.font = `15px ${pixel}`; ctx.fillStyle = '#111';
    ctx.fillText(this.t('atmStatementThanks').toUpperCase(), W / 2, y + 12);
    y += 40;
    let x = W / 2 - 150;
    let seed = [...(this.wallet || 'phleeca')].reduce((n, c) => n * 31 + c.charCodeAt(0) >>> 0, 7);
    ctx.fillStyle = '#111';
    while (x < W / 2 + 150) {
      seed = (seed * 1103515245 + 12345) >>> 0;
      const bw = 1 + (seed >> 8) % 4;
      ctx.fillRect(x, y, bw, 52);
      x += bw + 1 + (seed >> 12) % 3;
    }
    return canvas.toDataURL('image/png');
  }

  async openLog() {
    this.go('log');
    if (this.log() || !this.wallet) return;
    try {
      const rows = await this.dataSvc.fetchWalletLog(this.wallet, this.LOG_PAGE);
      this.log.set(rows);
      this.logHasMore.set(rows.length === this.LOG_PAGE);
    } catch { this.log.set([]); }
  }

  async loadMoreLog() {
    const cur = this.log();
    if (!cur || !this.wallet || this.logLoading()) return;
    this.logLoading.set(true);
    try {
      const rows = await this.dataSvc.fetchWalletLog(this.wallet, this.LOG_PAGE, cur.length);
      this.log.set([...cur, ...rows]);
      this.logHasMore.set(rows.length === this.LOG_PAGE);
    } catch {} finally { this.logLoading.set(false); }
  }

  /** one log line's wording, from the wallet's side of the event */
  logLabel(e: any): string {
    const me = (this.wallet || '').toLowerCase();
    const out = (e.from || '').toLowerCase() === me;
    switch (e.type) {
      case 'PhunkBought': return out ? 'atmLogSold' : 'atmLogBought';
      case 'PhunkOffered': return 'atmLogListed';
      case 'PhunkNoLongerForSale': return 'atmLogDelisted';
      case 'PhunkBidEntered': return out ? 'atmLogBidPlaced' : 'atmLogBidReceived';
      case 'PhunkBidWithdrawn': return 'atmLogBidWithdrawn';
      case 'escrow': return 'atmLogEscrowed';
      case 'created': return 'atmLogMinted';
      case 'transfer': return out ? 'atmLogSent' : 'atmLogReceived';
      case 'AuctionBid': return 'atmLogAuctionBid';
      case 'AuctionSettled': return out ? 'atmLogSold' : 'atmLogWonAuction';
      default: return e.type || '';
    }
  }

  /** the other side of a log line: who it went to (sales, sends) or came from (buys, receipts) */
  logOther(e: any): string {
    const me = (this.wallet || '').toLowerCase();
    const other = ((e.from || '').toLowerCase() === me ? e.to : e.from) || '';
    return other && other.toLowerCase() !== me ? other.slice(0, 6) + '…' + other.slice(-4) : '';
  }

  logValue(e: any): string {
    try { return e.value && BigInt(e.value) > 0n ? this.short(formatEther(BigInt(e.value))) : ''; } catch { return ''; }
  }

  logDate(e: any): string {
    const d = e.blockTimestamp ? new Date(e.blockTimestamp) : null;
    return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  }

  fundsTotal(): string {
    return formatEther((this.funds() || []).reduce((n, x) => n + x.wei, 0n));
  }

  fundsEth(wei: bigint): string {
    return formatEther(wei);
  }

  async withdrawFunds() {
    const f = this.funds() || [];
    if (!f.length) return;
    this.after = 'balance';
    if (!(await this.canSend())) return;
    this.screen.set('working');
    try {
      this.txHash.set(await this.actions.withdrawFunds(f));
      this.screen.set('done');
      this.loadFunds();
    } catch (err) {
      this.fail(err);
    }
  }

  t(key: string, params?: Record<string, string | number>) {
    return this.prefs.t(key, params);
  }
}
