import { Component, OnDestroy, OnInit, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { formatEther } from 'viem';

import { environment } from 'src/environments/environment';
import { GlobalState } from '@/models/global-state';
import { Web3Service } from '@/services/web3.service';
import { AuctionService, AuctionData, AuctionBidEvent, SettledAuction } from '@/services/auction.service';
import { PhunkInfoComponent } from '@/components/auction/phunk-info/phunk-info.component';
import { BidPanelComponent } from '@/components/auction/bid-panel/bid-panel.component';
import { AuctionSliderComponent } from '@/components/auction/auction-slider/auction-slider.component';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

@Component({
  selector: 'app-auction-page',
  standalone: true,
  imports: [
    CommonModule,
    PhunkInfoComponent,
    BidPanelComponent,
    AuctionSliderComponent,
  ],
  providers: [AuctionService],
  templateUrl: './auction-page.component.html',
  styleUrls: ['./auction-page.component.scss'],
})
export class AuctionPageComponent implements OnInit, OnDestroy {

  connected$ = this.store.select(appStateSelectors.selectConnected);

  auction = signal<AuctionData | null>(null);
  phunkImage = signal<string>('');
  phunkTokenId = signal<number>(0);
  phunkSlug = signal<string>('');
  phunkSha = signal<string>('');
  collectionName = signal<string>('');
  poolSize = signal<number>(0);
  reservePrice = signal<string>('0');
  minBidIncrement = signal<number>(10);
  bids = signal<AuctionBidEvent[]>([]);
  auctionEnded = signal(false);
  loading = signal(true);
  errorMessage = signal('');
  txPending = signal(false);
  txHash = signal<string>('');

  settledAuctions = signal<SettledAuction[]>([]);
  viewingAuctionId = signal<number | null>(null);
  maxAuctionId = signal<number>(0);
  isHistorical = signal(false);

  /** Stores the live (current) auction entry for the slider */
  liveAuctionEntry = signal<SettledAuction | null>(null);

  /** Settled auctions (oldest→newest) + live auction at end (right) */
  allAuctions = computed(() => {
    const settled = [...this.settledAuctions()].reverse();
    const live = this.liveAuctionEntry();

    if (!live) return settled;

    return [...settled.filter(s => s.auctionId !== live.auctionId), live];
  });

  canGoPrev = computed(() => {
    const viewing = this.viewingAuctionId();
    if (viewing !== null) return viewing > 0;
    return this.maxAuctionId() > 0;
  });

  canGoNext = computed(() => {
    const viewing = this.viewingAuctionId();
    if (viewing === null) return false;
    return viewing < this.maxAuctionId();
  });

  bgColor = signal<string>('');
  accentColor = signal<string>('');

  staticUrl = environment.staticUrl;
  explorerUrl = environment.explorerUrl;

  private pollInterval: any;

  constructor(
    private store: Store<GlobalState>,
    private auctionSvc: AuctionService,
    public web3Svc: Web3Service,
    private route: ActivatedRoute,
  ) {
    // Check for address override from route data (auction house 2)
    const overrideAddress = this.route.snapshot.data['auctionAddress'];
    if (overrideAddress) {
      this.auctionSvc.setAddress(overrideAddress);
    } else {
      this.auctionSvc.setAddress('');
    }
  }

  onMainImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    try {
      const tmp = document.createElement('canvas');
      tmp.width = img.naturalWidth;
      tmp.height = img.naturalHeight;
      const tmpCtx = tmp.getContext('2d')!;
      tmpCtx.drawImage(img, 0, 0);

      const bgPixel = tmpCtx.getImageData(0, 0, 1, 1).data;
      this.bgColor.set(`${bgPixel[0]}, ${bgPixel[1]}, ${bgPixel[2]}`);

      const imageData = tmpCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
      const accent = this.findAccentColor(imageData.data, bgPixel[0], bgPixel[1], bgPixel[2]);
      this.accentColor.set(accent);
    } catch {
      this.bgColor.set('');
      this.accentColor.set('');
    }
  }

  private findAccentColor(pixels: Uint8ClampedArray, bgR: number, bgG: number, bgB: number): string {
    const colorMap = new Map<string, { r: number; g: number; b: number; count: number; sat: number }>();

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];

      if (a < 128) continue;
      if (Math.abs(r - bgR) < 15 && Math.abs(g - bgG) < 15 && Math.abs(b - bgB) < 15) continue;
      if (r < 30 && g < 30 && b < 30) continue;
      if (r > 230 && g > 230 && b > 230) continue;

      const key = `${r},${g},${b}`;
      const existing = colorMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        const l = (max + min) / 2;
        const sat = max === min ? 0 : (l <= 0.5 ? (max - min) / (max + min) : (max - min) / (2 - max - min));
        colorMap.set(key, { r, g, b, count: 1, sat });
      }
    }

    let bestR = 0, bestG = 0, bestB = 0, bestScore = -1;

    for (const [, c] of colorMap) {
      if (c.count < 3) continue;
      const score = c.sat * Math.log(c.count + 1);
      if (score > bestScore) {
        bestR = c.r; bestG = c.g; bestB = c.b;
        bestScore = score;
      }
    }

    if (bestScore < 0) return '';
    return `${bestR}, ${bestG}, ${bestB}`;
  }

  async ngOnInit() {
    try {
      await this.loadAuction();
      this.loadSettledAuctions();
    } catch (err) {
      console.error('Auction init failed:', err);
    } finally {
      this.loading.set(false);
    }

    this.pollInterval = setInterval(() => {
      if (!this.isHistorical()) this.loadAuction();
    }, 30000);
  }

  ngOnDestroy() {
    clearInterval(this.pollInterval);
  }

  async loadAuction() {
    try {
      const { auction: auctionData, poolSize: poolSizeRaw, reservePrice: globalReserve, minBidIncrement: minBidInc } = await this.auctionSvc.getInitialData();

      this.auction.set(auctionData);
      this.poolSize.set(Number(poolSizeRaw));
      this.minBidIncrement.set(minBidInc);
      this.maxAuctionId.set(auctionData.auctionId);

      if (auctionData.startTime > 0) {
        this.auctionEnded.set(Date.now() >= auctionData.endTime * 1000);
      }

      const hasHashId = auctionData.hashId && auctionData.hashId !== '0x0000000000000000000000000000000000000000000000000000000000000000';

      if (hasHashId) {
        // Fetch item reserve, ethscription details, and bid history in parallel
        const [itemReserve, eth, bidHistory] = await Promise.all([
          this.auctionSvc.getItemReservePrice(auctionData.hashId),
          this.auctionSvc.getEthscriptionByHashId(auctionData.hashId),
          this.auctionSvc.getBidHistory(auctionData.auctionId),
        ]);

        this.reservePrice.set(formatEther(itemReserve > 0n ? itemReserve : globalReserve));
        this.bids.set(bidHistory);

        if (eth) {
          this.phunkImage.set(`${this.staticUrl}/static/images/${eth.sha}`);
          this.phunkTokenId.set(eth.tokenId);
          this.phunkSlug.set(eth.slug);
          this.phunkSha.set(eth.sha);

          this.liveAuctionEntry.set({
            auctionId: auctionData.auctionId,
            hashId: auctionData.hashId,
            winner: auctionData.bidder || '',
            amount: auctionData.amount ?? 0n,
            imageUrl: `${this.staticUrl}/static/images/${eth.sha}`,
            tokenId: eth.tokenId,
            slug: eth.slug,
            settledTimestamp: auctionData.startTime,
          });

          if (!this.collectionName()) {
            const name = await this.auctionSvc.getCollectionName(eth.slug);
            this.collectionName.set(name);
          }
        }
      } else {
        this.reservePrice.set(formatEther(globalReserve));
      }
    } catch (err) {
      console.error('Failed to load auction:', err);
    }
  }

  async loadSettledAuctions() {
    const settled = await this.auctionSvc.getSettledAuctions();
    this.settledAuctions.set(settled);
  }

  async loadHistoricalAuction(auctionId: number) {
    this.isHistorical.set(true);
    this.viewingAuctionId.set(auctionId);
    this.errorMessage.set('');
    this.txHash.set('');

    try {
      const [created, settled] = await Promise.all([
        this.auctionSvc.getAuctionCreatedEvent(auctionId),
        this.auctionSvc.getAuctionSettledEvent(auctionId),
      ]);

      if (!created) return;

      const auctionData: AuctionData = {
        hashId: created.hashId,
        amount: settled?.amount ?? 0n,
        startTime: created.startTime,
        endTime: created.endTime,
        bidder: settled?.winner ?? '',
        settled: true,
        auctionId,
      };

      this.auction.set(auctionData);
      this.auctionEnded.set(true);

      // Fetch reserve, ethscription, and bids in parallel
      const [globalReserve, itemReserve, eth, bidHistory] = await Promise.all([
        this.auctionSvc.getReservePrice(),
        this.auctionSvc.getItemReservePrice(created.hashId),
        this.auctionSvc.getEthscriptionByHashId(created.hashId),
        this.auctionSvc.getBidHistory(auctionId),
      ]);

      this.reservePrice.set(formatEther(itemReserve > 0n ? itemReserve : globalReserve));
      this.bids.set(bidHistory);

      if (eth) {
        this.phunkImage.set(`${this.staticUrl}/static/images/${eth.sha}`);
        this.phunkTokenId.set(eth.tokenId);
        this.phunkSlug.set(eth.slug);
        this.phunkSha.set(eth.sha);

        const name = await this.auctionSvc.getCollectionName(eth.slug);
        this.collectionName.set(name);
      }
    } catch (err) {
      console.error('Failed to load historical auction:', err);
    }
  }

  async prevAuction() {
    const current = this.viewingAuctionId() ?? this.maxAuctionId();
    if (current <= 0) return;
    await this.loadHistoricalAuction(current - 1);
  }

  async nextAuction() {
    const current = this.viewingAuctionId();
    if (current === null) return;

    if (current + 1 >= this.maxAuctionId()) {
      // Go back to live auction
      this.isHistorical.set(false);
      this.viewingAuctionId.set(null);
      await this.loadAuction();
    } else {
      await this.loadHistoricalAuction(current + 1);
    }
  }

  navigateToAuction(auctionId: number) {
    if (auctionId === this.maxAuctionId()) {
      this.isHistorical.set(false);
      this.viewingAuctionId.set(null);
      this.loadAuction();
    } else {
      this.loadHistoricalAuction(auctionId);
    }
  }

  handleTimerEvent(event: any) {
    if (event.left <= 0 && this.auction()?.startTime) {
      this.auctionEnded.set(true);
    }
  }

  get hasActiveAuction(): boolean {
    const a = this.auction();
    return !!a && a.startTime > 0;
  }

  async onPlaceBid(bidVal: string) {
    const connected = await firstValueFrom(this.connected$);
    if (!connected) {
      this.web3Svc.connect();
      return;
    }

    if (!bidVal || Number(bidVal) <= 0) {
      this.errorMessage.set('Enter a bid amount');
      return;
    }

    this.errorMessage.set('');
    this.txPending.set(true);
    this.txHash.set('');

    try {
      const hash = await this.auctionSvc.createBid(bidVal);
      if (hash) {
        this.txHash.set(hash);
        await this.web3Svc.pollReceipt(hash);
        this.txHash.set('');
        await this.loadAuction();
      }
    } catch (err: any) {
      this.errorMessage.set(err?.shortMessage || err?.message || 'Bid failed');
    } finally {
      this.txPending.set(false);
    }
  }

  async onSettle() {
    const connected = await firstValueFrom(this.connected$);
    if (!connected) {
      this.web3Svc.connect();
      return;
    }

    this.errorMessage.set('');
    this.txPending.set(true);
    this.txHash.set('');

    try {
      const hash = await this.auctionSvc.settleAndCreate();
      if (hash) {
        this.txHash.set(hash);
        await this.web3Svc.pollReceipt(hash);
        this.txHash.set('');
        await this.loadAuction();
        this.auctionEnded.set(false);
        this.loadSettledAuctions();
      }
    } catch (err: any) {
      this.errorMessage.set(err?.shortMessage || err?.message || 'Settle failed');
    } finally {
      this.txPending.set(false);
    }
  }

  closeError() {
    this.errorMessage.set('');
  }
}
