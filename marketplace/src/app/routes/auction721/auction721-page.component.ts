import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { formatEther } from 'viem';

import { GlobalState } from '@/models/global-state';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import { PhunkImageComponent } from '@/components/phunk-image/phunk-image.component';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { Web3Service } from '@/services/web3.service';
import { Auction721Row, Auction721Service, Bid721, Live721, Piece721, V67_NFT_ADDRESS, AUCTION721_ADDRESS } from '@/services/auction721.service';
import { itemRouterLink } from '@/constants/erc721c';

const IS_BOT = typeof navigator !== 'undefined' && /bot|crawl|spider|slurp|bytespider|reflection/i.test(navigator.userAgent);
const DYSTO_POOL_TOTAL = 2167;

type Mode = 'all' | 'dysto';

/**
 * ERC-721 auctions (V67AuctionHouse). Two faces:
 *  - mode 'all'   : the ERC-721 side of the /auction switch (every collection: Dysto pool + featured drops)
 *  - mode 'dysto' : /dysto, the Dysto auction house (v67 pieces only, its own look)
 *
 * RPC rule: history always comes from Supabase (indexer). The contract is only read while the indexer
 * shows an open auction; with nothing open the page makes no RPC calls at all.
 */
@Component({
  selector: 'app-auction721-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PhunkImageComponent],
  templateUrl: './auction721-page.component.html',
  styleUrls: ['./auction721-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  host: { '[class.embedded]': 'modeInput() !== undefined' },
})
export class Auction721PageComponent implements OnInit, OnDestroy {
  private readonly svc = inject(Auction721Service);
  private readonly prefs = inject(PhunkPreferencesService);
  private readonly web3Svc = inject(Web3Service);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject<Store<GlobalState>>(Store);

  /** Set by the hub (embedded) or by route data (/dysto). */
  modeInput = input<Mode | undefined>(undefined, { alias: 'mode' });
  mode = computed<Mode>(() => this.modeInput() ?? (this.route.snapshot.data['mode'] as Mode) ?? 'all');
  isDysto = computed(() => this.mode() === 'dysto');

  connected$ = this.store.select(appStateSelectors.selectConnected);
  wallet$ = this.store.select(appStateSelectors.selectWalletAddress);

  loaded = signal(false);
  history = signal<Auction721Row[]>([]);
  pieces = signal<Map<string, Piece721>>(new Map());
  live = signal<Live721 | null>(null);
  bids = signal<Bid721[]>([]);
  soldCount = signal(0);
  now = signal(Math.floor(Date.now() / 1000));

  bidValue = '';
  txPending = signal(false);
  txError = signal<string | null>(null);

  readonly auctionAddress = AUCTION721_ADDRESS;

  open = computed(() => this.svc.isOpen(this.history()));
  current = computed(() => (this.open() ? this.history()[0] : null));
  past = computed(() => this.history().filter((r) => r.settled));
  ended = computed(() => {
    const l = this.live();
    return !!l && !l.settled && this.now() >= l.endTime;
  });
  remaining = computed(() => {
    const l = this.live();
    if (!l) return '';
    let s = Math.max(0, l.endTime - this.now());
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    return (d ? `${d}d ` : '') + `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });
  /** Dysto pool still waiting (live read when open; otherwise total minus sold). */
  dystoLeft = computed(() => {
    const l = this.live();
    if (l) return l.poolSize + (l.collection.toLowerCase() === V67_NFT_ADDRESS.toLowerCase() && !l.fromQueue ? 1 : 0);
    return Math.max(0, DYSTO_POOL_TOTAL - this.soldCount());
  });
  topSale = computed(() => {
    let best: Auction721Row | null = null;
    for (const r of this.past()) if (r.outcome === 'sold' && (!best || BigInt(r.amount!) > BigInt(best.amount!))) best = r;
    return best;
  });

  private clock?: ReturnType<typeof setInterval>;
  private poll?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  t(key: string, params?: Record<string, string | number>): string {
    return this.prefs.t(key, params);
  }

  async ngOnInit() {
    await this.loadHistory();
    this.loaded.set(true);
    if (this.open() && !IS_BOT) {
      this.clock = setInterval(() => this.now.set(Math.floor(Date.now() / 1000)), 1000);
      await this.refreshLive();
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    if (this.clock) clearInterval(this.clock);
    if (this.poll) clearTimeout(this.poll);
  }

  private async loadHistory() {
    const coll = this.isDysto() ? V67_NFT_ADDRESS : undefined;
    const [rows, sold] = await Promise.all([this.svc.history(60, coll), this.svc.soldCount(coll)]);
    this.history.set(rows);
    this.soldCount.set(sold);
    this.pieces.set(await this.svc.pieces(rows.map((r) => ({ collection: r.collection, tokenId: r.tokenId }))));
    const cur = rows[0];
    this.bids.set(cur && !cur.settled ? await this.svc.bids(cur.auctionId) : []);
  }

  /** Contract read + Supabase bids, then schedule the next one (30 s, 10 s in the last 5 minutes). */
  private async refreshLive() {
    if (this.destroyed) return;
    try {
      const l = await this.svc.live();
      this.live.set(l);
      const cur = this.current();
      // The chain moved past what the indexer has (settled + next opened): reload history.
      if (cur && (cur.tokenId !== l.tokenId || cur.collection.toLowerCase() !== l.collection.toLowerCase())) await this.loadHistory();
      const c = this.current();
      if (c) this.bids.set(await this.svc.bids(c.auctionId));
      if (!this.svc.isOpen(this.history()) && l.settled) return; // nothing open any more: stop all RPC
      const left = l.endTime - Math.floor(Date.now() / 1000);
      this.poll = setTimeout(() => this.refreshLive(), left < 300 ? 10_000 : 30_000);
    } catch (e) {
      console.warn('auction721 live read failed', e);
      this.poll = setTimeout(() => this.refreshLive(), 60_000);
    }
  }

  pieceOf(r: { collection: string; tokenId: number }): Piece721 | undefined {
    return this.pieces().get(`${r.collection.toLowerCase()}:${r.tokenId}`);
  }

  link(r: { collection: string; tokenId: number }): any[] {
    const p = this.pieceOf(r);
    return itemRouterLink({ slug: p?.slug, hashId: p?.hashId, tokenId: r.tokenId });
  }

  collectionLabel(collection: string): string {
    return collection.toLowerCase() === V67_NFT_ADDRESS.toLowerCase() ? 'QuantumPhunks' : `${collection.slice(0, 6)}…${collection.slice(-4)}`;
  }

  eth(wei: bigint | string | null | undefined, digits = 4): string {
    if (wei == null) return '0';
    const n = Number(formatEther(BigInt(wei)));
    return n.toLocaleString(undefined, { maximumFractionDigits: digits });
  }

  short(a?: string | null): string {
    return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
  }

  fillMin() {
    const l = this.live();
    if (l) this.bidValue = formatEther(l.minNextBid);
  }

  async bid() {
    const l = this.live();
    if (!l || this.txPending()) return;
    this.txError.set(null);
    try {
      if (!this.bidValue || Number(this.bidValue) <= 0) throw new Error(this.t('a721EnterAmount'));
      this.txPending.set(true);
      const hash = await this.svc.createBid(l.collection, l.tokenId, this.bidValue);
      await (this.web3Svc.l1DedicatedClient as any).waitForTransactionReceipt({ hash });
      this.bidValue = '';
      if (this.poll) clearTimeout(this.poll);
      await this.refreshLive();
    } catch (e: any) {
      this.txError.set(e?.shortMessage || e?.message || String(e));
    } finally {
      this.txPending.set(false);
    }
  }

  async settle() {
    if (this.txPending()) return;
    this.txError.set(null);
    try {
      this.txPending.set(true);
      const hash = await this.svc.settle();
      await (this.web3Svc.l1DedicatedClient as any).waitForTransactionReceipt({ hash });
      await this.loadHistory();
      if (this.poll) clearTimeout(this.poll);
      await this.refreshLive();
    } catch (e: any) {
      this.txError.set(e?.shortMessage || e?.message || String(e));
    } finally {
      this.txPending.set(false);
    }
  }
}
