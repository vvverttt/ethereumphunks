import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatEther } from 'viem';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { TimeAgoPipe } from '@/pipes/time-ago.pipe';
import { SettledAuction } from '@/services/auction.service';

@Component({
  selector: 'app-auction-slider',
  standalone: true,
  imports: [CommonModule, WalletAddressDirective, TimeAgoPipe],
  templateUrl: './auction-slider.component.html',
  styleUrls: ['./auction-slider.component.scss'],
})
export class AuctionSliderComponent {

  @Input() settledAuctions: SettledAuction[] = [];

  @Output() selectAuction = new EventEmitter<number>();

  @ViewChild('sliderTrack') sliderTrack!: ElementRef<HTMLDivElement>;

  canScrollLeft = signal(false);
  canScrollRight = signal(false);

  scrollLeft() {
    this.sliderTrack?.nativeElement.scrollBy({ left: -300, behavior: 'smooth' });
  }

  scrollRight() {
    this.sliderTrack?.nativeElement.scrollBy({ left: 300, behavior: 'smooth' });
  }

  onScroll() {
    const el = this.sliderTrack?.nativeElement;
    if (!el) return;
    this.canScrollLeft.set(el.scrollLeft > 0);
    this.canScrollRight.set(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }

  formatEth(amount: bigint): string {
    if (!amount || amount === 0n) return '0';
    return formatEther(amount);
  }
}
