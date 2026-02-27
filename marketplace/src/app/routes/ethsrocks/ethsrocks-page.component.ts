import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { GlobalState } from '@/models/global-state';
import { Web3Service } from '@/services/web3.service';
import { EthsRocksService } from '@/services/ethsrocks.service';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

@Component({
  selector: 'app-ethsrocks-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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

  // TX state
  errorMessage = signal<string>('');
  txPending = signal<boolean>(false);
  txHash = signal<string>('');

  // Commit form
  usePhilipIntern = signal<boolean>(true);
  philipOrWrappedTokenId = signal<string>('');
  cryptoPhunksV2TokenId = signal<string>('');

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

  async onCommit() {
    const connected = await firstValueFrom(this.connected$);
    if (!connected) {
      this.web3Svc.connect();
      return;
    }

    const philipRaw = this.philipOrWrappedTokenId().trim();
    const v2Raw = this.cryptoPhunksV2TokenId().trim();

    if (!philipRaw || !v2Raw) {
      this.errorMessage.set('Enter both token IDs');
      return;
    }

    let philipOrWrappedId: bigint;
    let v2Id: bigint;
    try {
      philipOrWrappedId = BigInt(philipRaw);
      v2Id = BigInt(v2Raw);
    } catch {
      this.errorMessage.set('Invalid token ID');
      return;
    }

    const usePhilip = this.usePhilipIntern();
    this.errorMessage.set('');
    this.txPending.set(true);
    this.txHash.set('');

    try {
      const address = this.web3Svc.getCurrentAddress();
      if (!address) throw new Error('Wallet not connected');

      // Pre-validate ERC-721 ownership + usage
      const nftAddresses = await this.ethsrocksSvc.getNftAddresses();
      const nftContract = usePhilip ? nftAddresses.philipIntern : nftAddresses.wrappedV1;
      const contractLabel = usePhilip ? 'PhilipIntern' : 'WrappedV1';

      const [owner1, owner2, used1, used2] = await Promise.all([
        this.ethsrocksSvc.checkERC721Owner(nftContract, philipOrWrappedId),
        this.ethsrocksSvc.checkERC721Owner(nftAddresses.cryptoPhunksV2, v2Id),
        this.ethsrocksSvc.isERC721Used(nftContract, philipOrWrappedId),
        this.ethsrocksSvc.isERC721Used(nftAddresses.cryptoPhunksV2, v2Id),
      ]);

      if (owner1.toLowerCase() !== address.toLowerCase()) {
        throw new Error(`You don't own ${contractLabel} #${philipRaw}`);
      }
      if (owner2.toLowerCase() !== address.toLowerCase()) {
        throw new Error(`You don't own CryptoPhunksV2 #${v2Raw}`);
      }
      if (used1) {
        throw new Error(`${contractLabel} #${philipRaw} has already been used`);
      }
      if (used2) {
        throw new Error(`CryptoPhunksV2 #${v2Raw} has already been used`);
      }

      // Get backend authorization (ethscription hashes + signature)
      const auth = await this.ethsrocksSvc.getAuthorization(address);
      if (!auth.eligible) {
        throw new Error(auth.reason || 'Not eligible — missing required ethscriptions');
      }

      // Get current price
      const price = await this.ethsrocksSvc.getCurrentPrice();

      // Call commit
      const hash = await this.ethsrocksSvc.commit({
        signature: auth.signature! as `0x${string}`,
        deadline: BigInt(auth.deadline!),
        maxPrice: price,
        missingPhunkHash: auth.missingPhunkHash! as `0x${string}`,
        quantumDystoHash: auth.quantumDystoHash! as `0x${string}`,
        quantumPhunkHash: auth.quantumPhunkHash! as `0x${string}`,
        philipOrWrappedTokenId: philipOrWrappedId,
        usePhilipIntern: usePhilip,
        cryptoPhunksV2TokenId: v2Id,
        value: price,
      });

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
