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
}
