import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { formatEther } from 'viem';

import { GlobalState } from '@/models/global-state';
import { Phunk } from '@/models/db';
import { WalletGroup, detailsLink } from '@/utils/wallet-groups';
import { isErc721c } from '@/constants/erc721c';

import { OwnerAction, OwnerActionsService } from '@/services/owner-actions.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { Web3Service } from '@/services/web3.service';
import { DataService } from '@/services/data.service';

import { PhunkImageComponent } from '@/components/phunk-image/phunk-image.component';
import { TokenNumberPipe } from '@/pipes/token-number.pipe';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import { environment } from 'src/environments/environment';

/** home → collections → pieces → piece → (sell | transfer | confirm) → working → done / error,
 *  plus the balance and funds screens off the home menu. */
type Screen = 'home' | 'collections' | 'pieces' | 'piece' | 'many' | 'sell' | 'transfer' | 'confirm'
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

  /** the collections the wallet holds, in the site's order, with their pieces */
  @Input() groups: WalletGroup[] = [];
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
    if (!this.floorsAsked) { this.floorsAsked = true; this.loadFloors(); }
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
    this.screen.set(s);
  }

  openGroup(g: WalletGroup) {
    this.group.set(g);
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
    if (s === 'collections' || s === 'balance' || s === 'log') return this.go('home');
    if (s === 'pieces') { this.stopPicking(); return this.go('collections'); }
    if (s === 'piece' || s === 'many') return this.go('pieces');
    if (s === 'sell' || s === 'transfer' || s === 'confirm') { this.amount.set(''); this.recipient = ''; if (this.many()) this.pending.set(null); return this.go(this.many() ? 'many' : 'piece'); }
    if (s === 'funds') return this.go('balance');
    if (s === 'done' || s === 'error') return this.go(this.after);
    this.go('home');
  }

  /** the colours on screen: the open collection's, otherwise the site accent */
  accent(): string | null { return this.group()?.accent || null; }

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
      try { this.floors.set(await this.dataSvc.fetchFloors()); this.floorsFailed.set(false); return; }
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
