import { Component, ElementRef, OnDestroy, OnInit, ViewChild, signal, computed, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';

import { Subscription, firstValueFrom } from 'rxjs';
import { formatEther } from 'viem';

import { environment } from 'src/environments/environment';
import { GlobalState } from '@/models/global-state';
import { LotteryGridItem, LotteryWin, SpinPhase } from '@/models/lottery';

import { Web3Service } from '@/services/web3.service';
import { LotteryService, OwnedNft } from '@/services/lottery.service';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import { PhunkGridComponent } from '@/components/phunk-grid/phunk-grid.component';


// Build spin path based on grid size
function getSpinPath(count: number): number[] {
  if (count <= 1) return [0];
  if (count <= 4) {
    const forward = Array.from({ length: count }, (_, i) => i);
    const backward = Array.from({ length: count - 2 }, (_, i) => count - 2 - i);
    return [...forward, ...backward];
  }
  const topRow = Math.min(count, 4);
  const bottomRow = count - topRow;
  const path: number[] = [];
  for (let i = 0; i < topRow; i++) path.push(i);
  for (let i = topRow + bottomRow - 1; i >= topRow; i--) path.push(i);
  return path;
}

const INITIAL_STEP_DELAY = 200;
const DECAY_FACTOR = 1.12;
const MIN_ROTATIONS = 3;
const MAX_STEP_DELAY = 400;

@Component({
  selector: 'app-lottery',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PhunkGridComponent],
  templateUrl: './lottery.component.html',
  styleUrls: ['./lottery.component.scss']
})
export class LotteryComponent implements OnInit, OnDestroy {

  @ViewChild('fireworksCanvas', { static: true }) fireworksCanvas!: ElementRef<HTMLDivElement>;

  connected$ = this.store.select(appStateSelectors.selectConnected);
  address$ = this.store.select(appStateSelectors.selectWalletAddress);

  gridItems = signal<LotteryGridItem[]>(
    Array.from({ length: 8 }, (_, i) => ({
      index: i, hashId: '', sha: '', imageUrl: '/assets/images/lottery/philip.png',
      flipping: false, revealed: false, rightFacing: false,
    }))
  );
  spinPhase = signal<SpinPhase>('idle');
  activeFrameIndex = signal(-1);

  // Prizes won this spin (batch-aware; wonPrize = the first/primary).
  wonPrizes = signal<LotteryWin[]>([]);
  wonPrize = computed(() => this.wonPrizes()[0] || null);

  recentWins = signal<LotteryWin[]>([]);
  totalWinsCount = signal(0);

  // ─── Contract state ───
  mintPrice = signal(0n);               // base price per token (wei)
  mintPriceFormatted = computed(() => formatEther(this.mintPrice()));
  poolSize = signal(0);
  isActive = signal(true);
  maxBatchSize = signal(8);
  maxPerWallet = signal(67);
  mintsOf = signal(0);
  whitelistEnabled = signal(false);
  isWhitelisted = signal(false);
  discountsEnabled = signal(false);

  // ─── Play options ───
  quantity = signal(1);
  effectiveMaxQty = computed(() => {
    const walletRemaining = this.maxPerWallet() > 0 ? Math.max(0, this.maxPerWallet() - this.mintsOf()) : 999;
    return Math.max(1, Math.min(this.maxBatchSize(), this.poolSize() || 1, walletRemaining || 1));
  });
  quantityOptions = computed(() => Array.from({ length: this.effectiveMaxQty() }, (_, i) => i + 1));

  // ─── Surrender-for-discount ───
  surrenderNfts = signal<OwnedNft[]>([]);
  surrenderLoading = signal(false);
  selectedSurrenders = computed(() => this.surrenderNfts().filter(n => n.selected));

  // ─── Live quote ───
  quoteMint = signal(0n);   // mint payment after discount (wei)
  quoteVrf = signal(0n);    // estimated VRF fee (wei)
  quoteTotal = computed(() => this.quoteMint() + this.quoteVrf());
  quoteDiscount = signal(0n);
  baseTotal = computed(() => this.mintPrice() * BigInt(this.quantity()));
  hasDiscount = computed(() => this.quoteDiscount() > 0n);
  hasVrf = computed(() => this.quoteVrf() > 0n);

  /** Format a wei bigint as an ETH string for the template. */
  fmt(wei: bigint | null | undefined): string { return formatEther(wei ?? 0n); }
  quoteError = signal('');
  quoteLoading = signal(false);
  private quoteTimer: any;

  // ─── Owner ───
  isOwner = signal(false);
  contractSurplus = signal(0n);
  ownerPoolInput = signal('');
  ownerStatus = signal('');

  // ─── Stuck-ETH recovery ───
  pendingRefund = signal(0n);
  pendingRefundFormatted = computed(() => formatEther(this.pendingRefund()));
  hasPendingRefund = computed(() => this.pendingRefund() > 0n);

  loadedIn = signal(false);
  buttonShown = signal(false);
  errorMessage = signal('');
  confirmElapsed = signal(0);
  private confirmTimer: any;

  staticUrl = environment.staticUrl;
  philipFallback = '/assets/images/lottery/philip.png';
  private philipImageUrl = '';

  headerImages = computed(() => {
    const items = this.gridItems();
    if (!items.length) return Array.from({ length: 9 }, () => ({ src: '/assets/loadingphunk.png' }));
    return Array.from({ length: 9 }, (_, i) => ({ src: items[i % items.length].imageUrl }));
  });

  private recentWinsSub!: Subscription;
  private totalWinsCountSub!: Subscription;
  private spinTimeout: any;
  private spinPath: number[] = getSpinPath(8);
  private currentStepIndex = 0;
  private stepDelay = INITIAL_STEP_DELAY;
  private shouldDecelerate = false;
  private targetWinIndex = -1;
  private fireworks: any = null;
  private playInProgress = false;
  private pendingWinRecords: LotteryWin[] | null = null;
  private beforeUnloadHandler = (e: BeforeUnloadEvent) => { if (this.playInProgress) e.preventDefault(); };

  constructor(
    private store: Store<GlobalState>,
    private web3Svc: Web3Service,
    private lotterySvc: LotteryService,
    private ngZone: NgZone,
  ) {}

  async ngOnInit() {
    // Fetch token #10298 (Philip) image for grid placeholders
    try {
      const philip = await this.lotterySvc.getEthscriptionByTokenId(10298);
      if (philip?.sha) {
        this.philipImageUrl = `${this.staticUrl}/static/images/${philip.sha}`;
        this.philipFallback = this.philipImageUrl;
      }
    } catch {}

    await this.loadContractState();
    await this.initGrid();
    this.subscribeRecentWins();

    const address = await firstValueFrom(this.address$);
    if (address) await this.loadWalletState(address);

    // Re-load wallet-specific state when the wallet connects after page load.
    this.address$.subscribe(addr => { if (addr) this.loadWalletState(addr); });

    setTimeout(() => this.loadedIn.set(true), 300);
    setTimeout(() => this.buttonShown.set(true), 1400);
    window.addEventListener('beforeunload', this.beforeUnloadHandler);

    this.refreshQuote();
  }

  ngOnDestroy() {
    this.recentWinsSub?.unsubscribe();
    this.totalWinsCountSub?.unsubscribe();
    clearTimeout(this.spinTimeout);
    clearInterval(this.confirmTimer);
    clearTimeout(this.quoteTimer);
    this.stopFireworks();
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
  }

  // =========================================================
  // Contract / wallet state
  // =========================================================

  private async loadContractState() {
    try {
      const [price, active, size, maxBatch, maxWallet, wl, disc] = await Promise.all([
        this.lotterySvc.getMintPrice(),
        this.lotterySvc.isActive(),
        this.lotterySvc.getPoolSize(),
        this.lotterySvc.getMaxBatchSize(),
        this.lotterySvc.getMaxPerWallet(),
        this.lotterySvc.isWhitelistEnabled(),
        this.lotterySvc.isDiscountsEnabled(),
      ]);
      this.mintPrice.set(price);
      this.isActive.set(active);
      this.poolSize.set(Number(size));
      this.maxBatchSize.set(maxBatch);
      this.maxPerWallet.set(maxWallet);
      this.whitelistEnabled.set(wl);
      this.discountsEnabled.set(disc);
    } catch (err) {
      console.error('Failed to load contract state:', err);
    }
  }

  private async loadWalletState(address: string) {
    try {
      const [mints, whitelisted, refund] = await Promise.all([
        this.lotterySvc.getMintsOf(address),
        this.lotterySvc.isWhitelisted(address),
        this.lotterySvc.getPendingRefunds(address),
      ]);
      this.mintsOf.set(mints);
      this.isWhitelisted.set(whitelisted);
      this.pendingRefund.set(refund);

      // Clamp quantity to what's now allowed
      if (this.quantity() > this.effectiveMaxQty()) this.quantity.set(this.effectiveMaxQty());

      // Owner check
      const owner = await this.lotterySvc.getOwner();
      this.isOwner.set(owner.toLowerCase() === address.toLowerCase());
      if (this.isOwner()) {
        this.lotterySvc.getWithdrawableSurplus().then(s => this.contractSurplus.set(s)).catch(() => {});
      }

      if (this.discountsEnabled()) this.loadSurrenderNfts(address);
      this.refreshQuote();
    } catch (err) {
      console.error('Failed to load wallet state:', err);
    }
  }

  // =========================================================
  // Grid init (prizes = tokenId pool → image via ethscriptions table)
  // =========================================================

  private async initGrid() {
    const items: LotteryGridItem[] = [];
    const fallback = this.philipImageUrl || '/assets/images/lottery/philip.png';
    const pad = (from: LotteryGridItem[]) => {
      while (from.length < 8) from.push({ index: from.length, hashId: '', sha: '', imageUrl: fallback, flipping: false, revealed: false, rightFacing: false });
      return from;
    };

    try {
      const size = this.poolSize();
      if (size > 0) {
        const fetchCount = Math.min(size, 50);
        const maxOffset = Math.max(0, size - fetchCount);
        const randomOffset = maxOffset > 0 ? Math.floor(Math.random() * maxOffset) : 0;
        const tokenIds = await this.lotterySvc.getPoolItems(randomOffset, fetchCount);
        const rows = await this.lotterySvc.getEthscriptionsByTokenIds(tokenIds);
        const byToken = new Map(rows.map(r => [r.tokenId, r]));

        const seen = new Set<string>();
        const unique: { hashId: string; sha: string; tokenId: number; slug: string }[] = [];
        for (const id of tokenIds) {
          const e = byToken.get(id);
          if (e?.sha && !seen.has(e.sha)) { seen.add(e.sha); unique.push(e); }
        }

        for (let i = unique.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [unique[i], unique[j]] = [unique[j], unique[i]];
        }

        const displayCount = Math.min(unique.length, 8);
        for (let i = 0; i < displayCount; i++) {
          const eth = unique[i];
          items.push({
            index: i, hashId: eth.hashId || '', sha: eth.sha || '',
            imageUrl: eth.sha ? `${this.staticUrl}/static/images/${eth.sha}` : fallback,
            flipping: false, revealed: false, rightFacing: false,
          });
        }
        pad(items);
      } else {
        for (let i = 0; i < 8; i++) items.push({ index: i, hashId: '', sha: '', imageUrl: fallback, flipping: false, revealed: false, rightFacing: false });
      }
    } catch {
      for (let i = 0; i < 8; i++) items.push({ index: i, hashId: '', sha: '', imageUrl: fallback, flipping: false, revealed: false, rightFacing: false });
    }

    this.spinPath = getSpinPath(items.length);
    this.gridItems.set(items);
  }

  // =========================================================
  // Surrender-for-discount picker
  // =========================================================

  private async loadSurrenderNfts(address: string) {
    if (!this.lotterySvc.surrenderCollections.length) return;
    this.surrenderLoading.set(true);
    try {
      const all: OwnedNft[] = [];
      for (const coll of this.lotterySvc.surrenderCollections) {
        const eligible = await this.lotterySvc.isDiscountCollection(coll.address);
        if (!eligible) continue;
        const [tokenIds, defaultDiscount] = await Promise.all([
          this.lotterySvc.getOwnedTokenIds(address, coll.address),
          this.lotterySvc.getCollectionDefaultDiscount(coll.address),
        ]);
        for (const tokenId of tokenIds) {
          all.push({
            collection: coll.address, collectionLabel: coll.label, tokenId,
            imageUrl: '', discountWei: defaultDiscount, selected: false,
          });
        }
      }
      all.sort((a, b) => a.collectionLabel.localeCompare(b.collectionLabel) || a.tokenId - b.tokenId);
      this.surrenderNfts.set(all);
    } catch (err) {
      console.warn('Failed to load surrender NFTs:', err);
    } finally {
      this.surrenderLoading.set(false);
    }
  }

  toggleSurrender(collection: string, tokenId: number) {
    this.surrenderNfts.update(nfts =>
      nfts.map(n => (n.collection === collection && n.tokenId === tokenId) ? { ...n, selected: !n.selected } : n)
    );
    this.refreshQuote();
  }

  onQuantityChange(q: number) {
    this.quantity.set(Math.max(1, Math.min(q, this.effectiveMaxQty())));
    this.refreshQuote();
  }

  // Debounced live quote from the contract (exact after-discount price + VRF estimate).
  refreshQuote() {
    clearTimeout(this.quoteTimer);
    this.quoteTimer = setTimeout(() => this._refreshQuote(), 250);
  }

  private async _refreshQuote() {
    const address = await firstValueFrom(this.address$);
    const quantity = this.quantity();
    const selected = this.selectedSurrenders();
    const collections = selected.map(s => s.collection);
    const tokenIds = selected.map(s => s.tokenId);

    // Disconnected: show the plain base total (no discount, no VRF estimate yet).
    if (!address) {
      this.quoteMint.set(this.mintPrice() * BigInt(quantity));
      this.quoteVrf.set(0n);
      this.quoteDiscount.set(0n);
      this.quoteError.set('');
      return;
    }

    this.quoteLoading.set(true);
    this.quoteError.set('');
    try {
      const { mintPayment, vrfCost } = await this.lotterySvc.getTotalCost(address, quantity, collections, tokenIds);
      this.quoteMint.set(mintPayment);
      this.quoteVrf.set(vrfCost);
      this.quoteDiscount.set(this.mintPrice() * BigInt(quantity) - mintPayment);
    } catch (err: any) {
      // quote() reverts CreditExceedsOrder if the surrender is worth more than the order.
      const msg = err?.shortMessage || err?.message || '';
      this.quoteError.set(msg.includes('CreditExceedsOrder')
        ? 'Surrendered items are worth more than the order — deselect some or raise the quantity.'
        : 'Could not price this selection.');
      this.quoteMint.set(this.mintPrice() * BigInt(quantity));
      this.quoteVrf.set(0n);
      this.quoteDiscount.set(0n);
    } finally {
      this.quoteLoading.set(false);
    }
  }

  // =========================================================
  // Play flow
  // =========================================================

  async onPlay() {
    const connected = await firstValueFrom(this.connected$);
    if (!connected) { this.web3Svc.connect(); return; }
    if (this.spinPhase() !== 'idle' && this.spinPhase() !== 'won') return;

    if (!this.isActive()) { this.errorMessage.set('Lottery is currently inactive'); return; }
    if (this.poolSize() === 0) { this.errorMessage.set('No prizes available'); return; }

    const address = await firstValueFrom(this.address$);
    if (!address) { this.web3Svc.connect(); return; }

    if (this.whitelistEnabled() && !this.isWhitelisted()) {
      this.errorMessage.set('This phase is whitelist-only. Your wallet is not on the list yet.');
      return;
    }

    const quantity = Math.max(1, Math.min(this.quantity(), this.effectiveMaxQty()));
    if (quantity < 1) { this.errorMessage.set('Nothing available to mint'); return; }
    if (this.quoteError()) { this.errorMessage.set(this.quoteError()); return; }

    const selected = this.selectedSurrenders();
    const collections = selected.map(s => s.collection);
    const tokenIds = selected.map(s => s.tokenId);

    // Balance check: total cost (quote + VRF) + gas headroom
    try {
      const [balance, cost, block] = await Promise.all([
        this.web3Svc.l1Client.getBalance({ address: address as `0x${string}` }),
        this.lotterySvc.getTotalCost(address, quantity, collections, tokenIds),
        this.web3Svc.l1Client.getBlock(),
      ]);
      const baseFee = block.baseFeePerGas ?? 1000000000n;
      const gasBuffer = 400000n * baseFee * 2n;
      if (balance < cost.total + gasBuffer) { this.errorMessage.set('Insufficient ETH for mint + gas'); return; }
    } catch {}

    this.errorMessage.set('');
    this.wonPrizes.set([]);
    this.stopFireworks();
    this.spinPhase.set('loading');
    this.playInProgress = true;

    this.gridItems.update(items => items.map(item => ({ ...item, flipping: false, revealed: false })));

    try {
      const sinceMs = Date.now();

      // 1) Approvals for any surrendered collections (skips already-approved).
      if (collections.length) {
        this.ownerStatus.set('');
        await this.lotterySvc.ensureSurrenderApprovals(collections);
      }

      // 2) Single tx: requestMint → Chainlink VRF request
      const playHash = await this.lotterySvc.requestMint(quantity, collections, tokenIds);
      if (!playHash) throw new Error('Mint transaction failed');

      // 3) Wait for the request tx to mine
      this.spinPhase.set('committing');
      this.confirmElapsed.set(0);
      this.confirmTimer = setInterval(() => this.confirmElapsed.update(v => v + 1), 1000);
      await this.web3Svc.pollReceipt(playHash);
      clearInterval(this.confirmTimer);

      // 4) Wait for the VRF callback → indexer writes lottery_wins (watched via Supabase realtime)
      this.spinPhase.set('waiting');
      this.confirmElapsed.set(0);
      this.confirmTimer = setInterval(() => this.confirmElapsed.update(v => v + 1), 1000);

      const wins = await this.lotterySvc.watchForWins(address, sinceMs, quantity);
      clearInterval(this.confirmTimer);

      if (!wins.length) {
        // VRF/indexer hasn't landed within the window — leave a clear message; the win will
        // still show in Recent Wins once the indexer catches up. Offer stuck-spin recovery.
        this.spinPhase.set('idle');
        this.errorMessage.set('Your mint is confirmed but the result is still settling. It will appear in Recent Wins shortly.');
        await this.refreshAfterPlay(address);
        return;
      }

      // 5) Reveal — spin to the first won token; list them all in the result panel.
      this.wonPrizes.set(wins);
      this.pendingWinRecords = wins;

      const primary = wins[0];
      let winCellIndex = this.spinPath[primary.play_id % this.spinPath.length];
      const existingIdx = this.gridItems().findIndex(item => item.sha === primary.sha);
      if (existingIdx !== -1) {
        winCellIndex = existingIdx;
      } else if (primary.sha) {
        this.gridItems.update(items => items.map((item, i) =>
          i === winCellIndex ? { ...item, hashId: primary.hash_id, sha: primary.sha, imageUrl: `${this.staticUrl}/static/images/${primary.sha}` } : item
        ));
      }

      this.startSpin();
      this.targetWinIndex = winCellIndex;
      this.shouldDecelerate = true;

      await this.refreshAfterPlay(address);
    } catch (err: any) {
      clearInterval(this.confirmTimer);
      this.stopSpin();
      this.spinPhase.set('idle');
      let msg = err?.shortMessage || err?.message || 'Transaction failed';
      if (msg.includes('OnlyEOA') || msg.includes('No contracts')) msg = 'Smart-contract wallets are not supported. Please use a regular wallet.';
      else if (msg.includes('NotWhitelisted')) msg = 'This phase is whitelist-only.';
      else if (msg.includes('WalletLimitReached')) msg = 'You have reached the per-wallet mint limit.';
      else if (msg.includes('NoTokensAvailable')) msg = 'Not enough prizes left for that quantity.';
      this.errorMessage.set(msg);
    } finally {
      this.playInProgress = false;
    }
  }

  private async refreshAfterPlay(address: string) {
    try {
      const size = await this.lotterySvc.getPoolSize();
      this.poolSize.set(Number(size));
    } catch {}
    this.lotterySvc.getMintsOf(address).then(m => this.mintsOf.set(m)).catch(() => {});
    if (this.discountsEnabled()) this.loadSurrenderNfts(address);
    if (this.isOwner()) this.lotterySvc.getWithdrawableSurplus().then(s => this.contractSurplus.set(s)).catch(() => {});
  }

  // =========================================================
  // Stuck-ETH recovery
  // =========================================================

  async onWithdrawRefund() {
    try {
      const hash = await this.lotterySvc.withdrawRefund();
      if (hash) { await this.web3Svc.pollReceipt(hash); this.pendingRefund.set(0n); }
    } catch (err: any) {
      this.errorMessage.set(err?.shortMessage || err?.message || 'Withdraw failed');
    }
  }

  // =========================================================
  // Demo play (animation only, using real collection items)
  // =========================================================

  async onDemoPlay() {
    if (this.spinPhase() !== 'idle' && this.spinPhase() !== 'won') return;
    this.errorMessage.set('');
    this.wonPrizes.set([]);
    this.stopFireworks();
    this.spinPhase.set('loading');
    try {
      const demoItems = await this.lotterySvc.getRandomPoolItems(8);
      if (!demoItems.length) { this.errorMessage.set('No items found in database'); this.spinPhase.set('idle'); return; }

      const cellCount = Math.min(demoItems.length, 8);
      const items: LotteryGridItem[] = [];
      for (let i = 0; i < cellCount; i++) {
        const eth = demoItems[i];
        items.push({ index: i, hashId: eth.hashId, sha: eth.sha, imageUrl: `${this.staticUrl}/static/images/${eth.sha}`, flipping: false, revealed: false, rightFacing: false });
      }
      this.spinPath = getSpinPath(cellCount);
      this.gridItems.set(items);

      const winIndex = Math.floor(Math.random() * cellCount);
      const winner = demoItems[winIndex];
      this.startSpin();
      await new Promise(resolve => setTimeout(resolve, 2000));

      const winCellIndex = this.spinPath[winIndex % this.spinPath.length];
      this.gridItems.update(current => current.map((item, i) => i === winCellIndex ? { ...item, hashId: winner.hashId, sha: winner.sha, imageUrl: `${this.staticUrl}/static/images/${winner.sha}` } : item));
      this.targetWinIndex = winCellIndex;
      this.shouldDecelerate = true;

      this.wonPrizes.set([{
        id: 0, contract_address: this.lotterySvc.address.toLowerCase(), play_id: 0, winner: 'demo',
        hash_id: winner.hashId, sha: winner.sha, token_id: winner.tokenId, collection_slug: winner.slug,
        transfer_status: 'demo', tx_hash: '', created_at: new Date().toISOString(),
      }]);
    } catch (err: any) {
      this.stopSpin();
      this.spinPhase.set('idle');
      this.errorMessage.set(err?.message || 'Demo failed');
    }
  }

  // =========================================================
  // Spin animation (unchanged)
  // =========================================================

  private startSpin(initialPhase: SpinPhase = 'spinning') {
    this.spinPhase.set(initialPhase);
    this.currentStepIndex = 0;
    this.stepDelay = INITIAL_STEP_DELAY;
    this.shouldDecelerate = false;
    this.targetWinIndex = -1;
    this.gridItems.update(items => items.map(item => ({ ...item, flipping: false, revealed: false, rightFacing: false })));
    this.advanceFrame();
  }

  private advanceFrame() {
    const pathIndex = this.currentStepIndex % this.spinPath.length;
    const cellIndex = this.spinPath[pathIndex];
    this.activeFrameIndex.set(cellIndex);

    this.gridItems.update(items => items.map((item, i) => ({
      ...item,
      flipping: i === cellIndex,
      rightFacing: i === cellIndex,
      revealed: this.shouldDecelerate && i === this.targetWinIndex && cellIndex === this.targetWinIndex,
    })));

    this.currentStepIndex++;

    if (this.shouldDecelerate && this.currentStepIndex > MIN_ROTATIONS * this.spinPath.length) {
      this.stepDelay *= DECAY_FACTOR;
      this.spinPhase.set('decelerating');
      if (this.stepDelay > MAX_STEP_DELAY && cellIndex === this.targetWinIndex) { this.onSpinComplete(); return; }
    }
    if (this.currentStepIndex > 200) { this.onSpinComplete(); return; }

    const mirrorDelay = Math.min(this.stepDelay * 0.35, 220);
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => this.ngZone.run(() => {
        if (this.spinPhase() === 'spinning' || this.spinPhase() === 'decelerating') {
          this.gridItems.update(items => items.map(item => ({ ...item, rightFacing: false })));
        }
      }), mirrorDelay);
    });

    const flipBackDelay = Math.min(this.stepDelay * 0.7, 450);
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => this.ngZone.run(() => {
        if (this.spinPhase() === 'spinning' || this.spinPhase() === 'decelerating') {
          this.gridItems.update(items => items.map(item => ({ ...item, flipping: false })));
        }
      }), flipBackDelay);
    });

    this.ngZone.runOutsideAngular(() => {
      this.spinTimeout = setTimeout(() => this.ngZone.run(() => this.advanceFrame()), this.stepDelay);
    });
  }

  private onSpinComplete() {
    this.gridItems.update(items => items.map((item, i) => ({ ...item, flipping: false, rightFacing: false, revealed: i === this.targetWinIndex })));
    this.spinPhase.set('won');
    this.startFireworks();

    if (this.pendingWinRecords) {
      const records = this.pendingWinRecords;
      this.pendingWinRecords = null;
      setTimeout(() => {
        this.recentWins.update(wins => {
          const merged = [...wins];
          for (const r of records) if (!merged.some(w => w.token_id === r.token_id && w.contract_address === r.contract_address)) merged.unshift(r);
          return merged;
        });
      }, 4000);
    }
  }

  private stopSpin() {
    clearTimeout(this.spinTimeout);
    this.activeFrameIndex.set(-1);
    this.gridItems.update(items => items.map(item => ({ ...item, flipping: false })));
  }

  // =========================================================
  // Fireworks
  // =========================================================

  private async startFireworks() {
    try {
      const { Fireworks } = await import('fireworks-js');
      this.fireworks = new Fireworks(this.fireworksCanvas.nativeElement, {
        hue: { min: 0, max: 360 }, delay: { min: 15, max: 30 }, rocketsPoint: { min: 50, max: 50 },
        traceSpeed: 2, acceleration: 1.05, particles: 50,
      });
      this.fireworks.start();
      setTimeout(() => this.stopFireworks(), 10000);
    } catch (err) {
      console.error('Failed to start fireworks:', err);
    }
  }

  private stopFireworks() {
    if (this.fireworks) { this.fireworks.stop(); this.fireworks = null; }
  }

  // =========================================================
  // Recent wins
  // =========================================================

  private subscribeRecentWins() {
    let prevCount = 0;
    this.recentWinsSub = this.lotterySvc.fetchRecentWins().subscribe(wins => {
      if (prevCount > 0 && wins.length > prevCount) this.poolSize.update(s => Math.max(0, s - (wins.length - prevCount)));
      prevCount = wins.length;
      if (!this.playInProgress) this.recentWins.set(wins);
    });
    this.totalWinsCountSub = this.lotterySvc.fetchTotalWinsCount().subscribe(count => this.totalWinsCount.set(count));
  }

  getWinImageUrl(win: LotteryWin): string {
    return win.sha ? `${this.staticUrl}/static/images/${win.sha}` : '/assets/images/lottery/philip.png';
  }

  onSpinAgain() { window.location.reload(); }

  // =========================================================
  // Owner panel
  // =========================================================

  async onOwnerWithdrawSurplus() {
    try {
      const address = await firstValueFrom(this.address$);
      const surplus = await this.lotterySvc.getWithdrawableSurplus();
      if (!address || surplus === 0n) { this.ownerStatus.set('No surplus to withdraw'); return; }
      this.ownerStatus.set('Withdrawing...');
      const hash = await this.lotterySvc.withdrawSurplusETH(address, surplus);
      if (hash) {
        await this.web3Svc.pollReceipt(hash);
        this.contractSurplus.set(await this.lotterySvc.getWithdrawableSurplus());
        this.ownerStatus.set('Withdrew surplus ETH');
      }
    } catch (err: any) {
      this.ownerStatus.set(err?.shortMessage || err?.message || 'Withdraw failed');
    }
  }

  async onOwnerToggleActive() {
    try {
      this.ownerStatus.set('Updating...');
      const hash = await this.lotterySvc.setActive(!this.isActive());
      if (hash) {
        await this.web3Svc.pollReceipt(hash);
        this.isActive.set(await this.lotterySvc.isActive());
        this.ownerStatus.set('Lottery ' + (this.isActive() ? 'activated' : 'paused'));
      }
    } catch (err: any) {
      this.ownerStatus.set(err?.shortMessage || err?.message || 'Update failed');
    }
  }

  async onOwnerLoadPool() {
    const ids = this.ownerPoolInput()
      .split(/[\s,]+/).map(s => Number(s.trim())).filter(n => Number.isFinite(n) && n >= 0);
    if (!ids.length) { this.ownerStatus.set('Enter tokenIds to load'); return; }
    try {
      this.ownerStatus.set(`Loading ${ids.length} token(s)...`);
      const hash = await this.lotterySvc.addPoolTokens(ids);
      if (hash) {
        await this.web3Svc.pollReceipt(hash);
        this.poolSize.set(Number(await this.lotterySvc.getPoolSize()));
        this.ownerPoolInput.set('');
        this.ownerStatus.set(`Loaded ${ids.length} token(s)`);
        this.initGrid();
      }
    } catch (err: any) {
      this.ownerStatus.set(err?.shortMessage || err?.message || 'Load failed');
    }
  }
}
