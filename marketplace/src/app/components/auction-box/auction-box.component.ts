import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, firstValueFrom, map, startWith } from 'rxjs';
import { formatEther, parseEther } from 'viem';

import { Auction721Service } from '@/services/auction721.service';
import { SpriteService } from '@/services/sprite.service';
import { Web3Service } from '@/services/web3.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { GlobalState } from '@/models/global-state';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import { auctionPoll } from '@/utils/visible-interval';
import { IS_BOT } from '@/utils/is-bot';

const CLOSED_KEY = 'auctionBoxClosed';

/**
 * The live ERC-721 auction as a box that pops up in the bottom-right corner of every page: the
 * piece, its bids, the standing bid, the time left and a bid box, so a bid can go in from anywhere.
 * Closing it (×) shrinks it to a small LIVE tab that brings it back; that choice is remembered per
 * auction, so the next piece pops up again. Hidden on the auction page itself, which shows it all.
 *
 * Everything shown comes from Supabase (the indexer keeps the end time and every bid), shared with
 * the menu card; refreshed every 60 s, every 10 s in the last 2 minutes, never in a hidden tab.
 * The only contract read is one minNextBid when someone starts typing a bid, for an exact minimum.
 */
@Component({
  selector: 'app-auction-box',
  standalone: true,
  imports: [RouterModule, FormsModule],
  templateUrl: './auction-box.component.html',
  styleUrls: ['./auction-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionBoxComponent implements OnInit, OnDestroy {
  private readonly a721 = inject(Auction721Service);
  private readonly spriteSvc = inject(SpriteService);
  private readonly web3Svc = inject(Web3Service);
  private readonly prefs = inject(PhunkPreferencesService);
  private readonly store = inject<Store<GlobalState>>(Store);
  private readonly router = inject(Router);

  image = signal('');
  auctionId = signal(0);
  tokenId = signal(0);
  collection = signal('');
  name = signal('');
  topBid = signal(0n);
  bidCount = signal(0);
  endTime = signal(0);
  now = signal(Date.now());

  expanded = signal(true);
  bidValue = '';
  minBid = signal('');
  pending = signal(false);
  txHash = signal('');
  error = signal('');
  done = signal(false);

  /** Not on the auction page itself: that page already shows the auction in full. */
  private onAuctionPage = toSignal(this.router.events.pipe(
    filter((e) => e instanceof NavigationEnd),
    startWith(null),
    map(() => this.router.url.startsWith('/auction')),
  ), { initialValue: false });

  open = computed(() => !!this.image() && this.endTime() > 0 && !this.onAuctionPage());
  ended = computed(() => this.endTime() > 0 && this.now() / 1000 >= this.endTime());

  bidEth = computed(() => {
    const v = this.topBid();
    return v === 0n ? '0' : String(parseFloat(Number(formatEther(v)).toFixed(4)));
  });

  /** "1d 03:12:45", "03:12:45", or the ended label once the clock runs out. */
  left = computed(() => {
    const s = Math.max(0, Math.floor(this.endTime() - this.now() / 1000));
    if (s === 0) return this.t('stripEnded');
    const d = Math.floor(s / 86400);
    const pad = (n: number) => String(n).padStart(2, '0');
    const hms = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    return d ? `${d}d ${hms}` : hms;
  });

  private stopPoll?: () => void;
  private tick?: ReturnType<typeof setInterval>;
  private exactMinRead = false;

  t(key: string, params?: Record<string, string | number>): string {
    return this.prefs.t(key, params);
  }

  async ngOnInit() {
    if (IS_BOT) return;
    await this.load();
    this.stopPoll = auctionPoll(() => this.load(), () => this.endTime() * 1000);
    this.tick = setInterval(() => this.now.set(Date.now()), 1000);
  }

  ngOnDestroy() {
    this.stopPoll?.();
    if (this.tick) clearInterval(this.tick);
  }

  close() {
    this.expanded.set(false);
    try { localStorage.setItem(CLOSED_KEY, String(this.auctionId())); } catch { /* private mode */ }
  }

  reopen() {
    this.expanded.set(true);
    try { localStorage.removeItem(CLOSED_KEY); } catch { /* private mode */ }
  }

  /** First time someone touches the bid box: read the exact minimum from the contract, once. */
  async readExactMin() {
    if (this.exactMinRead) return;
    this.exactMinRead = true;
    try {
      const l = await this.a721.live();
      if (l.tokenId !== this.tokenId()) return;
      const min = formatEther(l.minNextBid);
      this.minBid.set(min);
      if (!this.bidValue || Number(this.bidValue) < Number(min)) this.bidValue = min;
    } catch {
      this.exactMinRead = false;
    }
  }

  async placeBid() {
    if (this.pending() || this.ended()) return;
    if (!(await firstValueFrom(this.store.select(appStateSelectors.selectConnected)))) {
      this.web3Svc.connect();
      return;
    }
    await this.readExactMin();
    this.error.set('');
    this.done.set(false);
    try {
      if (this.minBid() && parseEther(String(this.bidValue)) < parseEther(this.minBid())) {
        this.error.set(this.t('stripMinBidIs', { min: this.minBid() }));
        return;
      }
    } catch {
      this.error.set(this.t('stripMinBidIs', { min: this.minBid() || '0.001' }));
      return;
    }
    this.pending.set(true);
    try {
      const hash = await this.a721.createBid(this.collection(), this.tokenId(), String(this.bidValue));
      this.txHash.set(hash);
      await (this.web3Svc.l1DedicatedClient as any).waitForTransactionReceipt({ hash });
      this.done.set(true);
      this.txHash.set('');
      this.exactMinRead = false;
      // the indexer records the bid within a block or two; read again shortly after
      setTimeout(() => this.load(true), 15_000);
    } catch (e: any) {
      this.error.set(e?.shortMessage || e?.message || String(e));
    } finally {
      this.pending.set(false);
    }
  }

  private async load(fresh = false) {
    const snap = await this.a721.snapshot(fresh ? 0 : 20_000);
    if (!snap) { this.image.set(''); return; }
    const newPiece = snap.row.auctionId !== this.auctionId();
    this.image.set(await this.spriteSvc.url(snap.piece.sha!));
    this.auctionId.set(snap.row.auctionId);
    this.tokenId.set(snap.row.tokenId);
    this.collection.set(snap.row.collection);
    this.topBid.set(snap.topBid);
    this.bidCount.set(snap.bidCount);
    this.endTime.set(snap.endTime);
    if (!this.name()) this.name.set(await this.a721.collectionName(snap.piece.slug));

    // Smallest next bid without a contract read: +5% rounded up, or the 0.001 opening price.
    const top = snap.topBid;
    const min = formatEther(top === 0n ? 1_000_000_000_000_000n : (top * 10_500n + 9_999n) / 10_000n);
    if (!this.exactMinRead || newPiece) this.minBid.set(min);
    if (newPiece) {
      this.bidValue = min;
      this.exactMinRead = false;
      this.done.set(false);
      this.error.set('');
      // closed for this auction stays closed; a new piece pops up again
      let closedFor = '';
      try { closedFor = localStorage.getItem(CLOSED_KEY) ?? ''; } catch { /* private mode */ }
      this.expanded.set(closedFor !== String(snap.row.auctionId));
    } else if (!this.bidValue) {
      this.bidValue = min;
    }
  }
}
