import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';

import { GlobalState } from '@/models/global-state';
import { Web3Service } from '@/services/web3.service';
import { EthsRocksService } from '@/services/ethsrocks.service';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

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
  loading = signal<boolean>(true);

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
  }

  async loadState() {
    const state = await this.ethsrocksSvc.getContractState();
    if (state) {
      this.currentPrice.set(state.priceFormatted);
      this.poolSize.set(state.poolSize);
      this.totalSold.set(state.totalSold);
      this.remaining.set(state.remaining);
      this.isPaused.set(state.paused);
    }

    // Check if connected user has a commitment
    const address = this.web3Svc.getCurrentAddress();
    if (address) {
      try {
        const commitment = await this.ethsrocksSvc.getCommitment(address);
        if (commitment.commitBlock > 0n) {
          this.hasCommitment.set(true);
          this.commitBlock.set(Number(commitment.commitBlock));
        }
      } catch {}
    }
  }

  async onReveal() {
    try {
      await this.ethsrocksSvc.reveal();
      await this.loadState();
    } catch (err: any) {
      console.error('Reveal failed:', err);
    }
  }

  async onCancel() {
    try {
      await this.ethsrocksSvc.cancelCommitment();
      this.hasCommitment.set(false);
      await this.loadState();
    } catch (err: any) {
      console.error('Cancel failed:', err);
    }
  }
}
