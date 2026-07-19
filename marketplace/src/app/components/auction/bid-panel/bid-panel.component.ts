import { Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { formatEther } from 'viem';

import { TimerComponent } from '@/components/auction/timer/timer.component';
import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { AuctionData, AuctionBidEvent } from '@/services/auction.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

@Component({
  selector: 'app-bid-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TimerComponent,
    WalletAddressDirective,
    WeiToEthPipe,
  ],
  templateUrl: './bid-panel.component.html',
  styleUrls: ['./bid-panel.component.scss'],
})
export class BidPanelComponent {

  @Input() auction: AuctionData | null = null;
  @Input() bids: AuctionBidEvent[] = [];
  @Input() connected = false;
  @Input() auctionEnded = false;
  @Input() reservePrice = '0';
  @Input() minBidIncrement = 10;
  @Input() txPending = false;
  @Input() txHash = '';
  @Input() errorMessage = '';
  @Input() explorerUrl = '';
  @Input() isHistorical = false;
  @Input() noAuction = false;
  /** Remaining items in the auction pool — used to offer "Start Next Auction" after a buy-now. */
  @Input() poolSize = 0;

  // ─── Buy-now (two tiers) ────────────────────────────────────────────────────
  // Each tier: Live = enabled on-chain AND bundle root matches; Eligible = wallet has a proof.
  // Tier 1 = Missing/Dysto (buyNow, ~0.267, RIGHT). Tier 2 = EthsRocks (buyNow2, ~0.167, LEFT).
  @Input() buyNow1Live = false;
  @Input() buyNow1Eligible = false;
  @Input() buyNow1PriceEth = '0';
  @Input() buyNow2Live = false;
  @Input() buyNow2Eligible = false;
  @Input() buyNow2PriceEth = '0';

  @Output() buyNow1 = new EventEmitter<void>();
  @Output() buyNow2 = new EventEmitter<void>();

  @Output() placeBid = new EventEmitter<string>();
  @Output() settle = new EventEmitter<void>();
  @Output() connect = new EventEmitter<void>();
  @Output() closeError = new EventEmitter<void>();
  @Output() closeTx = new EventEmitter<void>();
  @Output() timerEvent = new EventEmitter<any>();

  bidValue = new FormControl<string>('');

  constructor(public preferences: PhunkPreferencesService) {}

  t(key: string): string {
    return this.preferences.t(key);
  }

  get currentBidEth(): string {
    const a = this.auction;
    if (!a || a.amount === 0n) return '0';
    return formatEther(a.amount);
  }

  get minNextBid(): string {
    const a = this.auction;
    if (!a) return this.reservePrice;
    if (!a.bidder || a.bidder === '0x0000000000000000000000000000000000000000') {
      return this.reservePrice;
    }
    const current = Number(formatEther(a.amount));
    return (current + current * this.minBidIncrement / 100).toFixed(6);
  }

  onSubmitBid() {
    const val = this.bidValue.value;
    if (!val || Number(val) <= 0) return;
    this.placeBid.emit(val);
    this.bidValue.reset();
  }

  /**
   * Mirrors the contract's buyNow() preconditions: a live, unsettled, unexpired auction with
   * NO bid yet. The moment anyone bids, buy-now reverts on-chain — so it must disappear here too,
   * otherwise we'd be offering a button that always fails.
   */
  private get buyNowWindowOpen(): boolean {
    const a = this.auction;
    if (!a || this.noAuction || this.isHistorical) return false;
    if (a.settled || this.auctionEnded) return false;
    if (a.endTime && Date.now() >= a.endTime * 1000) return false;
    const hasBid =
      this.bids.length > 0 ||
      (!!a.bidder && a.bidder !== '0x0000000000000000000000000000000000000000');
    return !hasBid;
  }

  // A tier's button shows when the window is open, that tier is live on-chain, and the wallet is
  // eligible for it. A wallet in both tiers sees both buttons (EthsRocks left, Missing/Dysto right).
  get showBuyNow1(): boolean {
    return this.buyNowWindowOpen && this.buyNow1Live && this.connected && this.buyNow1Eligible;
  }
  get showBuyNow2(): boolean {
    return this.buyNowWindowOpen && this.buyNow2Live && this.connected && this.buyNow2Eligible;
  }
  get canBuyNow1(): boolean { return this.showBuyNow1 && !this.txPending; }
  get canBuyNow2(): boolean { return this.showBuyNow2 && !this.txPending; }
}
