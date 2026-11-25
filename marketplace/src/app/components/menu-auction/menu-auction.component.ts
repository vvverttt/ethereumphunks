import { Component, OnDestroy, OnInit, computed, inject, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { formatEther } from 'viem';

import { AUCTIONS_LIVE, AuctionService, AuctionData } from '@/services/auction.service';
import { Auction721Service } from '@/services/auction721.service';
import { SpriteService } from '@/services/sprite.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';
import { TimerComponent } from '@/components/auction/timer/timer.component';
import { auctionPoll } from '@/utils/visible-interval';

/**
 * The live auction as a card in the menu panel: the item, its bid count, the standing bid and
 * the time left — a link to the auction house. Without a live auction it is just the link.
 *
 * The menu renders it only while open, and while it is it re-reads every 30 s (not in a hidden
 * tab). The read is shared with the collection page's auction bar, so both open costs one.
 */
@Component({
  selector: 'app-menu-auction',
  standalone: true,
  imports: [RouterModule, TimerComponent],
  // AuctionService is not root-provided (each user may point it at another auction house) —
  // without this the card failed to construct and vanished from the menu.
  providers: [AuctionService],
  templateUrl: './menu-auction.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./menu-auction.component.scss'],
})
export class MenuAuctionComponent implements OnInit, OnDestroy {

  private readonly auctionSvc = inject(AuctionService);
  private readonly spriteSvc = inject(SpriteService);
  private readonly preferences = inject(PhunkPreferencesService);
  private readonly router = inject(Router);
  private readonly a721 = inject(Auction721Service);

  title = input.required<string>();
  /** Clicked through to the auction house. */
  navigate = output<void>();

  auction = signal<AuctionData | null>(null);
  image = signal('');
  tokenId = signal(0);
  bidCount = signal(0);
  /** The card shows the ERC-721 auction house (Phunkmas), so it links to that side of /auction. */
  erc721 = signal(false);

  live = computed(() => {
    const a = this.auction();
    return !!a && !a.settled && a.startTime > 0 && !!this.image();
  });

  /** Standing bid, at most 4 decimals ("0.0081"); 0 before the first bid. */
  currentEth = computed(() => {
    const a = this.auction();
    if (!a || a.amount === 0n) return '0';
    return String(parseFloat(Number(formatEther(a.amount)).toFixed(4)));
  });

  endTimeMs = computed(() => (this.auction()?.endTime ?? 0) * 1000);

  private stopPoll?: () => void;

  t(key: string): string {
    return this.preferences.t(key);
  }

  async ngOnInit() {
    // The Ethscriptions house is closed: show the ERC-721 house's live auction instead (Supabase
    // only, no RPC: the indexer keeps the end time and every bid).
    const load = AUCTIONS_LIVE ? () => this.load() : () => this.load721();
    await load();
    // On the auction page itself the page shows the auction live, so the card keeps its first
    // read (its countdown still ticks) instead of polling alongside it.
    // Every 60 s, tightening to 10 s in the last 2 minutes.
    this.stopPoll = auctionPoll(() => {
      if (!this.router.url.startsWith('/auction')) load();
    }, () => this.endTimeMs());
  }

  ngOnDestroy() {
    this.stopPoll?.();
  }

  private async load721() {
    try {
      const snap = await this.a721.snapshot();
      if (!snap) { this.auction.set(null); return; }
      const image = await this.spriteSvc.url(snap.piece.sha!);
      this.erc721.set(true);
      this.auction.set({
        hashId: snap.piece.hashId ?? '',
        amount: snap.topBid,
        startTime: snap.startTime,
        endTime: snap.endTime,
        bidder: '',
        settled: false,
        auctionId: snap.row.auctionId,
      });
      this.tokenId.set(snap.row.tokenId);
      this.image.set(image);
      this.bidCount.set(snap.bidCount);
    } catch {
      // Keep the last good read; with none, the card is just the link.
    }
  }

  private async load() {
    try {
      // Shared with the collection page's auction bar (see AuctionService.getLiveSnapshot).
      const { auction, eth, bids } = await this.auctionSvc.getLiveSnapshot();
      if (!eth) return;
      const image = await this.spriteSvc.url(eth.sha);
      this.auction.set(auction);
      this.tokenId.set(eth.tokenId);
      this.image.set(image);
      this.bidCount.set(bids.length);
    } catch {
      // Keep the last good read; with none, the card is just the link.
    }
  }
}
