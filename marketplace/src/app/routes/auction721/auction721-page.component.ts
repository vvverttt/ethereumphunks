import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subscription, filter, firstValueFrom } from 'rxjs';
import { formatEther } from 'viem';

import { environment } from 'src/environments/environment';
import { GlobalState } from '@/models/global-state';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import * as dataStateActions from '@/state/actions/data-state.actions';
import { Web3Service } from '@/services/web3.service';
import { SpriteService } from '@/services/sprite.service';
import { ThemeService } from '@/services/theme.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { AuctionData, AuctionBidEvent, SettledAuction } from '@/services/auction.service';
import { AUCTION721_ADDRESS, Auction721Row, Auction721Service, Live721, V67_NFT_ADDRESS } from '@/services/auction721.service';
import { PhunkInfoComponent } from '@/components/auction/phunk-info/phunk-info.component';
import { BidPanelComponent } from '@/components/auction/bid-panel/bid-panel.component';
import { BidEasterEggComponent } from '@/components/auction/bid-easter-egg/bid-easter-egg.component';
import { AuctionSliderComponent } from '@/components/auction/auction-slider/auction-slider.component';
import { AuctionSwitchComponent } from '@/components/auction/auction-switch/auction-switch.component';
import { AuctionAboutComponent } from '@/components/auction/auction-about/auction-about.component';
import { IS_BOT } from '@/utils/is-bot';
import { animationFor } from '@/utils/phunk-animation';

const ZERO = '0x0000000000000000000000000000000000000000';
type Mode = 'all' | 'dysto';

/**
 * ERC-721 auction house (V67AuctionHouse). Same look and the same building blocks as the Ethscriptions
 * auction page (hero, piece info with prev/next, history slider, bid panel), fed from this contract.
 *
 *  - mode 'all'   : the ERC-721 side of the /auction switch
 *  - mode 'dysto' : /dysto, v67 (Dysto) pieces only
 *
 * RPC rule: history and past auctions always come from Supabase (indexer). The contract is read only
 * while the newest auction is open; with nothing open the page makes no RPC calls.
 */
@Component({
  selector: 'app-auction721-page',
  standalone: true,
  imports: [CommonModule, PhunkInfoComponent, BidPanelComponent, BidEasterEggComponent, AuctionSliderComponent, AuctionSwitchComponent, AuctionAboutComponent],
  templateUrl: './auction721-page.component.html',
  styleUrls: ['../auction/auction-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class Auction721PageComponent implements OnInit, OnDestroy {
  private readonly svc = inject(Auction721Service);
  private readonly prefs = inject(PhunkPreferencesService);
  private readonly spriteSvc = inject(SpriteService);
  private readonly themeSvc = inject(ThemeService);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject<Store<GlobalState>>(Store);
  readonly web3Svc = inject(Web3Service);

  modeInput = input<Mode | undefined>(undefined, { alias: 'mode' });
  mode = computed<Mode>(() => this.modeInput() ?? (this.route.snapshot.data['mode'] as Mode) ?? 'all');
  isDysto = computed(() => this.mode() === 'dysto');

  connected$ = this.store.select(appStateSelectors.selectConnected);
  explorerUrl = environment.explorerUrl;
  /** The ERC-721 auction house contract (for the about section's link). */
  readonly houseAddress: string = AUCTION721_ADDRESS;

  // ---- same state shape as the Ethscriptions page, so the shared components bind the same way
  auction = signal<AuctionData | null>(null);
  phunkImage = signal('');
  phunkTokenId = signal(0);
  phunkSlug = signal('');
  /** Christmas look: a Phunkmas piece on the block, or the house with nothing on it yet (Phunkmas are first up). */
  xmas = computed(() => this.phunkSlug() === 'phunksmas' || (!this.phunkSlug() && !this.isDysto()));
  phunkSha = signal('');

  // Phunkmas viewer, same as the item page: hover shows the tray (still / creation animation /
  // mirror), clicking the picture flips it.
  anim = signal<string | null>(null);
  /** 0 still, 1 creation animation, 2 mirror */
  view = signal<0 | 1 | 2>(0);
  flipped = signal(false);
  /** bumps each time the animation is picked, so it restarts from the first frame */
  playKey = signal(0);

  pick(v: 0 | 1 | 2) {
    this.view.set(v);
    this.flipped.set(v === 2);
    if (v === 1) this.playKey.update((k) => k + 1);
  }
  collectionName = signal('');
  poolSize = signal(0);
  reservePrice = signal('0');
  minBidExact = signal('');
  readonly minBidIncrement = 5;
  bids = signal<AuctionBidEvent[]>([]);
  auctionEnded = signal(false);
  loading = signal(true);
  errorMessage = signal('');
  txPending = signal(false);
  txHash = signal('');
  updating = signal(false);
  settledLoaded = signal(false);
  isHistorical = signal(false);
  viewingAuctionId = signal<number | null>(null);
  maxAuctionId = signal(0);
  bgColor = signal('');
  accentColor = signal('');

  private rows = signal<Auction721Row[]>([]);
  private live = signal<Live721 | null>(null);
  private history = signal<SettledAuction[]>([]);

  /** Settled (oldest -> newest) + the live one at the right end, for the slider. */
  allAuctions = computed(() => [...this.history()].reverse());
  canGoPrev = computed(() => {
    const v = this.viewingAuctionId();
    return v !== null ? v > this.minId() : this.maxAuctionId() > this.minId();
  });
  canGoNext = computed(() => {
    const v = this.viewingAuctionId();
    return v !== null && v < this.maxAuctionId();
  });
  private minId = computed(() => 1);

  get hasActiveAuction(): boolean {
    const a = this.auction();
    return !!a && a.startTime > 0;
  }

  private poll?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  t(key: string, params?: Record<string, string | number>): string {
    return this.prefs.t(key, params);
  }

  async ngOnInit() {
    // The ERC-721 house wears the Phunkmas Christmas theme from first paint (they are first up), never the
    // Halloween one; once the piece is known, a non-Phunkmas piece switches it to the v67 blue (showRow).
    this.applyTheme(null);
    try {
      await this.loadHistory();
      await this.showNewest();
    } catch (e) {
      console.error('auction721 load failed', e);
    } finally {
      this.loading.set(false);
      this.settledLoaded.set(true);
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.headerSub?.unsubscribe();
    if (this.poll) clearTimeout(this.poll);
  }

  // ------------------------------------------------------------------ data

  private coll(): string | undefined {
    return this.isDysto() ? V67_NFT_ADDRESS : undefined;
  }

  /** Supabase only. Builds the slider entries and resolves their art. */
  private async loadHistory() {
    const rows = await this.svc.history(200, this.coll());
    this.rows.set(rows);
    this.maxAuctionId.set(rows[0]?.auctionId ?? 0);
    const pieces = await this.svc.pieces(rows.map((r) => ({ collection: r.collection, tokenId: r.tokenId })));
    const entries: SettledAuction[] = [];
    for (const r of rows) {
      const p = pieces.get(`${r.collection.toLowerCase()}:${r.tokenId}`);
      entries.push({
        auctionId: r.auctionId,
        hashId: p?.hashId ?? '',
        winner: r.winner ?? '',
        amount: BigInt(r.amount ?? '0'),
        imageUrl: p?.sha ? await this.spriteSvc.url(p.sha) : '',
        tokenId: r.tokenId,
        slug: p?.slug ?? '',
        // seconds (the timeAgo pipe's unit); an open auction counts from when it started, since its
        // end time is still ahead
        settledTimestamp: Math.floor(new Date(r.settledAt ?? (r.settled ? r.endTime : r.startTime)).getTime() / 1000),
      });
    }
    this.history.set(entries.filter((e) => !!e.imageUrl));
  }

  /** The newest auction: live (contract reads) if it is open, otherwise shown like a past one. */
  private async showNewest() {
    const newest = this.rows()[0];
    this.isHistorical.set(false);
    this.viewingAuctionId.set(null);
    if (!newest) {
      this.auction.set(null);
      return;
    }
    await this.showRow(newest);
    if (!newest.settled && !IS_BOT) await this.refreshLive();
  }

  /** Put one auction row on screen (art, name, bids). No RPC. */
  private async showRow(r: Auction721Row) {
    const p = await this.svc.piece(r.collection, r.tokenId);
    this.auction.set({
      hashId: p.hashId ?? '',
      amount: BigInt(r.amount ?? '0'),
      startTime: Math.floor(new Date(r.startTime).getTime() / 1000),
      endTime: Math.floor(new Date(r.endTime).getTime() / 1000),
      bidder: r.winner ?? '',
      settled: r.settled,
      auctionId: r.auctionId,
    });
    this.auctionEnded.set(r.settled || Date.now() >= new Date(r.endTime).getTime());
    this.phunkTokenId.set(r.tokenId);
    this.phunkSlug.set(p.slug ?? '');
    this.phunkSha.set(p.sha ?? '');
    this.phunkImage.set(p.sha ? await this.spriteSvc.url(p.sha) : '');
    this.view.set(0); this.flipped.set(false); this.anim.set(null);
    const tokenId = r.tokenId;
    animationFor({ slug: p.slug, tokenId }).then((a) => { if (this.phunkTokenId() === tokenId) this.anim.set(a); });
    this.collectionName.set(await this.svc.collectionName(p.slug));
    this.applyTheme(p.slug);
    const bids = await this.svc.bids(r.auctionId);
    this.bids.set(bids.map((b) => ({ sender: b.bidder, value: b.amount, txHash: b.txHash })));
    if (!this.minBidExact()) this.reservePrice.set(formatEther(BigInt(r.amount ?? '0') || 1_000_000_000_000_000n));
  }

  /** Contract reads for the open auction; reschedules itself (30 s, 10 s in the last 5 minutes). */
  private async refreshLive() {
    if (this.destroyed || this.isHistorical()) return;
    try {
      this.updating.set(true);
      const l = await this.svc.live();
      this.live.set(l);
      const newest = this.rows()[0];
      if (!newest || newest.tokenId !== l.tokenId || newest.collection.toLowerCase() !== l.collection.toLowerCase()) {
        // the chain is ahead of the indexer (settled + next opened): reload from Supabase
        await this.loadHistory();
        const n = this.rows()[0];
        if (n) await this.showRow(n);
      }
      const a = this.auction();
      if (a) this.auction.set({ ...a, amount: l.amount, bidder: l.bidder === ZERO ? '' : l.bidder, endTime: l.endTime, settled: l.settled });
      this.poolSize.set(l.poolSize + l.queueSize);
      this.minBidExact.set(formatEther(l.minNextBid));
      if (l.bidder === ZERO) this.reservePrice.set(formatEther(l.minNextBid));
      this.auctionEnded.set(l.settled || Date.now() / 1000 >= l.endTime);
      const n = this.rows()[0];
      if (n) {
        const bids = await this.svc.bids(n.auctionId);
        this.bids.set(bids.map((b) => ({ sender: b.bidder, value: b.amount, txHash: b.txHash })));
      }
      if (l.settled) return; // nothing open any more: stop all RPC
      const left = l.endTime - Math.floor(Date.now() / 1000);
      this.poll = setTimeout(() => this.refreshLive(), left < 300 ? 10_000 : 30_000);
    } catch (e) {
      console.warn('auction721 live read failed', e);
      this.poll = setTimeout(() => this.refreshLive(), 60_000);
    } finally {
      this.updating.set(false);
    }
  }

  /** Collections that bring their own look to the ERC-721 house; everything else wears the v67 blue. */
  private static readonly OWN_THEME = new Set(['phunksmas']);

  private headerSub?: Subscription;
  private headerSlug = '';

  private applyTheme(pieceSlug: string | null) {
    // No piece yet: the house opens with the Phunkmas, so it wears their Christmas theme (the Dysto page keeps v67 blue).
    const slug = pieceSlug
      ? (Auction721PageComponent.OWN_THEME.has(pieceSlug) ? pieceSlug : 'cryptophunksv67')
      : (this.isDysto() ? 'cryptophunksv67' : 'phunksmas');
    this.themeSvc.setActiveCollection(slug);
    this.headerSlug = slug;
    this.setHeaderCollection();
    // The store's default-collection effect resets the header switcher whenever the collections
    // list (re)loads, so set it again after each load, one tick later.
    this.headerSub ??= this.store.select(dataStateSelectors.selectCollections)
      .pipe(filter((c) => !!c?.length))
      .subscribe(() => setTimeout(() => { if (!this.destroyed) this.setHeaderCollection(); }));
  }

  private setHeaderCollection() {
    firstValueFrom(this.store.select(dataStateSelectors.selectCollections)).then((collections) => {
      const c = collections?.find((x: any) => x.slug === this.headerSlug);
      if (c) this.store.dispatch(dataStateActions.setActiveCollection({ activeCollection: { ...c } }));
    });
  }

  // ------------------------------------------------------------------ navigation (Supabase only)

  private async showPast(auctionId: number) {
    if (this.poll) clearTimeout(this.poll);
    this.isHistorical.set(true);
    this.viewingAuctionId.set(auctionId);
    this.errorMessage.set('');
    this.txHash.set('');
    this.minBidExact.set('');
    const r = this.rows().find((x) => x.auctionId === auctionId) ?? (await this.svc.byId(auctionId));
    if (r) await this.showRow(r);
  }

  async prevAuction() {
    const cur = this.viewingAuctionId() ?? this.maxAuctionId();
    const ids = this.rows().map((r) => r.auctionId).filter((id) => id < cur);
    const prev = ids.length ? Math.max(...ids) : cur - 1;
    if (prev >= 1) await this.showPast(prev);
  }

  async nextAuction() {
    const cur = this.viewingAuctionId();
    if (cur === null) return;
    const ids = this.rows().map((r) => r.auctionId).filter((id) => id > cur);
    const next = ids.length ? Math.min(...ids) : cur + 1;
    if (next >= this.maxAuctionId()) await this.showNewest();
    else await this.showPast(next);
  }

  navigateToAuction(auctionId: number) {
    if (auctionId === this.maxAuctionId()) this.showNewest();
    else this.showPast(auctionId);
  }

  handleTimerEvent(event: any) {
    if (event.left <= 0 && this.auction()?.startTime) this.auctionEnded.set(true);
  }

  // ------------------------------------------------------------------ the same art-derived colours

  onMainImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    try {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const bg = ctx.getImageData(0, 0, 1, 1).data;
      this.bgColor.set(`${bg[0]}, ${bg[1]}, ${bg[2]}`);
      const px = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data;
      const map = new Map<string, { r: number; g: number; b: number; n: number; s: number }>();
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        if (px[i + 3] < 128) continue;
        if (Math.abs(r - bg[0]) < 15 && Math.abs(g - bg[1]) < 15 && Math.abs(b - bg[2]) < 15) continue;
        if ((r < 30 && g < 30 && b < 30) || (r > 230 && g > 230 && b > 230)) continue;
        const k = `${r},${g},${b}`;
        const e = map.get(k);
        if (e) e.n++;
        else {
          const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, l = (max + min) / 2;
          map.set(k, { r, g, b, n: 1, s: max === min ? 0 : l <= 0.5 ? (max - min) / (max + min) : (max - min) / (2 - max - min) });
        }
      }
      let best = '', score = -1;
      for (const [, v] of map) {
        if (v.n < 3) continue;
        const sc = v.s * Math.log(v.n + 1);
        if (sc > score) { score = sc; best = `${v.r}, ${v.g}, ${v.b}`; }
      }
      this.accentColor.set(best);
    } catch {
      this.bgColor.set('');
      this.accentColor.set('');
    }
  }

  // ------------------------------------------------------------------ actions

  async onPlaceBid(bidVal: string) {
    if (!(await firstValueFrom(this.connected$))) { this.web3Svc.connect(); return; }
    const l = this.live();
    if (!l || this.txPending()) return;
    this.errorMessage.set('');
    this.txPending.set(true);
    try {
      const hash = await this.svc.createBid(l.collection, l.tokenId, bidVal);
      this.txHash.set(hash);
      await (this.web3Svc.l1DedicatedClient as any).waitForTransactionReceipt({ hash });
      this.txHash.set('');
      if (this.poll) clearTimeout(this.poll);
      await this.refreshLive();
    } catch (e: any) {
      this.errorMessage.set(e?.shortMessage || e?.message || String(e));
    } finally {
      this.txPending.set(false);
    }
  }

  async onSettle() {
    if (!(await firstValueFrom(this.connected$))) { this.web3Svc.connect(); return; }
    if (this.txPending()) return;
    this.errorMessage.set('');
    this.txPending.set(true);
    try {
      const hash = await this.svc.settle();
      this.txHash.set(hash);
      await (this.web3Svc.l1DedicatedClient as any).waitForTransactionReceipt({ hash });
      this.txHash.set('');
      if (this.poll) clearTimeout(this.poll);
      await this.refreshLive();
    } catch (e: any) {
      this.errorMessage.set(e?.shortMessage || e?.message || String(e));
    } finally {
      this.txPending.set(false);
    }
  }

  closeError() {
    this.errorMessage.set('');
  }
}
