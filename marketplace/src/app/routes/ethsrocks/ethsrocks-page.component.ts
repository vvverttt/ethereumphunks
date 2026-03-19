import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { GlobalState } from '@/models/global-state';
import { Web3Service } from '@/services/web3.service';
import { EthsRocksService, RockPurchase } from '@/services/ethsrocks.service';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

// Fixed ETH increment per sale (matches contract BASE_PRICE)
const BASE_PRICE_ETH = 0.001;

@Component({
  selector: 'app-ethsrocks-page',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl: './ethsrocks-page.component.html',
  styleUrls: ['./ethsrocks-page.component.scss'],
})
export class EthsRocksPageComponent implements OnInit {

  connected$ = this.store.select(appStateSelectors.selectConnected);
  address$ = this.store.select(appStateSelectors.selectWalletAddress);

  // Contract state
  currentPrice = signal<string>('--');
  poolSize = signal<number>(0);
  totalSold = signal<number>(0);
  remaining = signal<number>(0);
  isPaused = signal<boolean>(true);
  hasContract = signal<boolean>(false);

  // Commitment state
  hasCommitment = signal<boolean>(false);
  commitBlock = signal<number>(0);
  currentBlock = signal<number>(0);
  canReveal = signal<boolean>(false);
  isExpired = signal<boolean>(false);
  blocksUntilReveal = signal<number>(0);
  loading = signal<boolean>(true);
  walletChecked = signal<boolean>(false);

  // TX state
  errorMessage = signal<string>('');
  txPending = signal<boolean>(false);
  txHash = signal<string>('');

  // Purchase history
  purchaseHistory = signal<RockPurchase[]>([]);
  historyLoading = signal<boolean>(false);

  // Price curve chart
  totalSupply = signal<number>(0);

  // Bar chart — one bar per sale
  barWidth = 12;
  barGap = 4;
  chartH = 300;

  chartBars = computed(() => {
    const supply = this.totalSupply();
    if (supply <= 0) return [];
    const sold = this.totalSold();
    const maxEth = BASE_PRICE_ETH * supply;
    const h = this.chartH;

    const bars: { x: number; y: number; height: number; sale: number; eth: string; state: 'sold' | 'next' | 'future' }[] = [];
    for (let i = 1; i <= supply; i++) {
      const ethPrice = BASE_PRICE_ETH * i;
      const barH = (ethPrice / maxEth) * h;
      const x = (i - 1) * (this.barWidth + this.barGap);
      bars.push({
        x,
        y: h - barH,
        height: barH,
        sale: i,
        eth: ethPrice.toFixed(4) + ' ETH',
        state: i <= sold ? 'sold' : i === sold + 1 ? 'next' : 'future',
      });
    }
    return bars;
  });

  chartTotalWidth = computed(() => {
    const supply = this.totalSupply();
    return supply * (this.barWidth + this.barGap);
  });

  chartViewBox = computed(() => {
    const w = this.chartTotalWidth();
    return `-80 -35 ${w + 100} ${this.chartH + 75}`;
  });

  chartMaxEth = computed(() => {
    const supply = this.totalSupply();
    return supply > 0 ? (BASE_PRICE_ETH * supply).toFixed(4) + ' ETH' : '';
  });
  chartMidEth = computed(() => {
    const supply = this.totalSupply();
    return supply > 0 ? (BASE_PRICE_ETH * supply / 2).toFixed(4) + ' ETH' : '';
  });
  currentPriceEth = computed(() => {
    const sold = this.totalSold();
    return (BASE_PRICE_ETH * (sold + 1)).toFixed(4) + ' ETH';
  });
  priceIncrementEth = computed(() => {
    return BASE_PRICE_ETH.toFixed(4) + ' ETH';
  });

  explorerUrl = (environment as any).explorerUrl || 'https://etherscan.io';

  constructor(
    private store: Store<GlobalState>,
    private web3Svc: Web3Service,
    private ethsrocksSvc: EthsRocksService,
  ) {}

  async ngOnInit() {
    this.hasContract.set(this.ethsrocksSvc.hasAddress);
    if (!this.ethsrocksSvc.hasAddress) {
      this.loading.set(false);
      return;
    }

    await this.loadState();
    this.loading.set(false);
    this.loadPurchaseHistory();

    // Re-check commitment when wallet address becomes available after page load
    this.address$.subscribe(addr => {
      if (addr) this.loadState();
    });
  }

  async loadState() {
    const state = await this.ethsrocksSvc.getContractState();
    if (state) {
      this.currentPrice.set(state.priceFormatted);
      this.poolSize.set(state.poolSize);
      this.totalSold.set(state.totalSold);
      this.remaining.set(state.remaining);
      this.isPaused.set(state.paused);
      this.totalSupply.set(state.poolSize + state.totalSold);
    }

    // Check if connected user has a commitment
    const address = this.web3Svc.getCurrentAddress();
    if (address) {
      try {
        const commitment = await this.ethsrocksSvc.getCommitment(address);
        if (commitment.commitBlock > 0n) {
          this.hasCommitment.set(true);
          this.commitBlock.set(Number(commitment.commitBlock));

          const blockNum = await this.web3Svc.l1Client.getBlockNumber();
          const current = Number(blockNum);
          this.currentBlock.set(current);
          const revealBlock = Number(commitment.commitBlock) + 2;
          const expiryBlock = Number(commitment.commitBlock) + 256;
          const blocksLeft = revealBlock - current;
          this.canReveal.set(blocksLeft <= 0 && current <= expiryBlock);
          this.isExpired.set(current > expiryBlock);
          this.blocksUntilReveal.set(Math.max(0, blocksLeft));
        } else {
          this.hasCommitment.set(false);
        }
      } catch {}
      this.walletChecked.set(true);
    }
  }

  async loadPurchaseHistory() {
    this.historyLoading.set(true);
    try {
      const history = await this.ethsrocksSvc.getPurchaseHistory();
      this.purchaseHistory.set(history);
    } catch {
    } finally {
      this.historyLoading.set(false);
    }
  }

  async onCommit() {
    const connected = await firstValueFrom(this.connected$);
    if (!connected) {
      this.web3Svc.connect();
      return;
    }

    this.errorMessage.set('');
    this.txPending.set(true);
    this.txHash.set('');

    try {
      const price = await this.ethsrocksSvc.getCurrentPrice();
      const hash = await this.ethsrocksSvc.commit(price, price);

      if (hash) {
        this.txHash.set(hash);
        await this.web3Svc.pollReceipt(hash);
        this.txHash.set('');
        this.hasCommitment.set(true);
        await this.loadState();
      }
    } catch (err: any) {
      this.errorMessage.set(err?.shortMessage || err?.message || 'Commit failed');
    } finally {
      this.txPending.set(false);
    }
  }

  async onReveal() {
    const connected = await firstValueFrom(this.connected$);
    if (!connected) { this.web3Svc.connect(); return; }

    this.errorMessage.set('');
    this.txPending.set(true);
    this.txHash.set('');

    try {
      const hash = await this.ethsrocksSvc.reveal();
      if (hash) {
        this.txHash.set(hash);
        await this.web3Svc.pollReceipt(hash);
        this.txHash.set('');
        this.hasCommitment.set(false);
        await this.loadState();
        this.loadPurchaseHistory();
      }
    } catch (err: any) {
      this.errorMessage.set(err?.shortMessage || err?.message || 'Reveal failed');
    } finally {
      this.txPending.set(false);
    }
  }

  async onCancel() {
    const connected = await firstValueFrom(this.connected$);
    if (!connected) { this.web3Svc.connect(); return; }

    this.errorMessage.set('');
    this.txPending.set(true);
    this.txHash.set('');

    try {
      const hash = await this.ethsrocksSvc.cancelCommitment();
      if (hash) {
        this.txHash.set(hash);
        await this.web3Svc.pollReceipt(hash);
        this.txHash.set('');
        this.hasCommitment.set(false);
        await this.loadState();
      }
    } catch (err: any) {
      this.errorMessage.set(err?.shortMessage || err?.message || 'Cancel failed');
    } finally {
      this.txPending.set(false);
    }
  }
}
