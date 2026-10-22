import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { parseEther } from 'viem';

import { GlobalState } from '@/models/global-state';
import { AuctionBidEvent } from '@/services/auction.service';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import { BID_EGGS, BidEgg, EGG_LINES, bidEgg } from '@/utils/bid-eggs';

const SEEN_KEY = 'EtherPhunks_bid_eggs_seen';

/**
 * Easter eggs for bids whose digits spell something. Shown once, only to the wallet that
 * placed the bid. `?egg=<key>` previews one (no wallet needed).
 */
@Component({
  selector: 'app-bid-easter-egg',
  standalone: true,
  templateUrl: './bid-easter-egg.component.html',
  styleUrls: ['./bid-easter-egg.component.scss'],
})
export class BidEasterEggComponent implements OnInit, OnChanges, OnDestroy {

  @Input() bids: AuctionBidEvent[] = [];

  private store = inject<Store<GlobalState>>(Store);
  private wallet = toSignal(this.store.select(appStateSelectors.selectWalletAddress));

  egg = signal<BidEgg | null>(null);
  line = signal('');
  bid = signal<AuctionBidEvent | null>(null);

  constructor(private el: ElementRef<HTMLElement>) {}

  // Lifted to <body>: inside the auction page's layers a fixed overlay sat under the header
  // and, on phones, opened off-screen.
  ngOnInit() {
    document.body.appendChild(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.el.nativeElement.remove();
  }

  ngOnChanges() {
    if (this.egg()) return;

    const preview = new URLSearchParams(location.search).get('egg');
    if (preview) {
      const egg = BID_EGGS.find((e) => e.key === preview);
      // The sample amount, so the preview reads like a real bid of that kind.
      if (egg) {
        this.egg.set(egg);
        this.pickLine();
        this.bid.set({ sender: this.wallet() || this.bids[0]?.sender || '', value: parseEther(egg.sample), txHash: 'preview' });
      }
      return;
    }

    const me = this.wallet()?.toLowerCase();
    if (!me) return;
    const seen = this.seen();
    for (const b of this.bids) {
      if (b.sender?.toLowerCase() !== me || seen.includes(b.txHash)) continue;
      const egg = bidEgg(b.value);
      if (!egg) continue;
      this.egg.set(egg);
      this.pickLine();
      this.bid.set(b);
      try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, b.txHash].slice(-50))); } catch { /* private mode */ }
      return;
    }
  }

  /** Digit/letter pairs to flip, or null when the word isn't a one-for-one spelling. */
  pairs(egg: BidEgg) {
    if (egg.digits.length !== egg.word.length) return null;
    return egg.digits.split('').map((digit, i) => ({ digit, letter: egg.word[i] }));
  }

  private pickLine() {
    this.line.set(EGG_LINES[Math.floor(Math.random() * EGG_LINES.length)]);
  }

  close() {
    this.egg.set(null);
  }

  private seen(): string[] {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
  }
}
