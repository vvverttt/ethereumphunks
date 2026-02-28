import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';

import { environment } from 'src/environments/environment';
import { GlobalState } from '@/models/global-state';
import { Web3Service } from '@/services/web3.service';
import { EthsRocksService, UsedPurchase } from '@/services/ethsrocks.service';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

interface TokenOption {
  id: bigint;
  label: string;       // e.g. "PhilipIntern #42"
  contract: `0x${string}`;
  isPhilipIntern: boolean;
}

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
  currentBlock = signal<number>(0);
  canReveal = signal<boolean>(false);
  blocksUntilReveal = signal<number>(0);
  loading = signal<boolean>(true);

  // TX state
  errorMessage = signal<string>('');
  txPending = signal<boolean>(false);
  txHash = signal<string>('');

  // Purchase history
  purchaseHistory = signal<UsedPurchase[]>([]);
  historyLoading = signal<boolean>(false);

  // Auto-detected tokens
  philipOrWrappedTokens = signal<TokenOption[]>([]);
  cryptoPhunksV2Tokens = signal<TokenOption[]>([]);
  selectedPhilipOrWrapped = signal<string>('');   // "contract:tokenId"
  selectedCryptoPhunksV2 = signal<string>('');    // "contract:tokenId"
  tokensLoading = signal<boolean>(false);

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

          // Check reveal readiness (REVEAL_DELAY = 2 blocks)
          const blockNum = await this.web3Svc.l1Client.getBlockNumber();
          const current = Number(blockNum);
          this.currentBlock.set(current);
          const revealBlock = Number(commitment.commitBlock) + 2;
          const blocksLeft = revealBlock - current;
          this.canReveal.set(blocksLeft <= 0);
          this.blocksUntilReveal.set(Math.max(0, blocksLeft));
        }
      } catch {}

      // Auto-detect tokens if no commitment
      if (!this.hasCommitment()) {
        await this.loadUserTokens(address);
      }
    }
  }

  async loadUserTokens(address: `0x${string}`) {
    this.tokensLoading.set(true);
    try {
      const nftAddresses = await this.ethsrocksSvc.getNftAddresses();

      const [philipTokens, wrappedTokens, v2Tokens] = await Promise.all([
        this.ethsrocksSvc.getAvailableTokens(nftAddresses.philipIntern, address),
        this.ethsrocksSvc.getAvailableTokens(nftAddresses.wrappedV1, address),
        this.ethsrocksSvc.getAvailableTokens(nftAddresses.cryptoPhunksV2, address),
      ]);

      const philipOrWrapped: TokenOption[] = [
        ...philipTokens.map(id => ({
          id,
          label: `PhilipIntern #${id}`,
          contract: nftAddresses.philipIntern,
          isPhilipIntern: true,
        })),
        ...wrappedTokens.map(id => ({
          id,
          label: `Wrapped V1 #${id}`,
          contract: nftAddresses.wrappedV1,
          isPhilipIntern: false,
        })),
      ];

      const v2Options: TokenOption[] = v2Tokens.map(id => ({
        id,
        label: `CryptoPhunksV2 #${id}`,
        contract: nftAddresses.cryptoPhunksV2,
        isPhilipIntern: false,
      }));

      this.philipOrWrappedTokens.set(philipOrWrapped);
      this.cryptoPhunksV2Tokens.set(v2Options);

      // Auto-select if only one option
      if (philipOrWrapped.length === 1) {
        this.selectedPhilipOrWrapped.set(`${philipOrWrapped[0].contract}:${philipOrWrapped[0].id}`);
      }
      if (v2Options.length === 1) {
        this.selectedCryptoPhunksV2.set(`${v2Options[0].contract}:${v2Options[0].id}`);
      }
    } catch (e) {
      console.error('Failed to load user tokens:', e);
    } finally {
      this.tokensLoading.set(false);
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

  private parseSelection(val: string): { contract: `0x${string}`; tokenId: bigint } | null {
    if (!val) return null;
    const [contract, idStr] = val.split(':');
    return { contract: contract as `0x${string}`, tokenId: BigInt(idStr) };
  }

  async onCommit() {
    const connected = await firstValueFrom(this.connected$);
    if (!connected) {
      this.web3Svc.connect();
      return;
    }

    const sel1 = this.parseSelection(this.selectedPhilipOrWrapped());
    const sel2 = this.parseSelection(this.selectedCryptoPhunksV2());

    if (!sel1 || !sel2) {
      this.errorMessage.set('Select both tokens');
      return;
    }

    // Find which token option was selected to determine usePhilipIntern
    const selectedOption = this.philipOrWrappedTokens().find(
      t => t.contract === sel1.contract && t.id === sel1.tokenId
    );
    const usePhilip = selectedOption?.isPhilipIntern ?? true;

    this.errorMessage.set('');
    this.txPending.set(true);
    this.txHash.set('');

    try {
      const address = this.web3Svc.getCurrentAddress();
      if (!address) throw new Error('Wallet not connected');

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
        philipOrWrappedTokenId: sel1.tokenId,
        usePhilipIntern: usePhilip,
        cryptoPhunksV2TokenId: sel2.tokenId,
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
