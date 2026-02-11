import { Component, ElementRef, OnDestroy, OnInit, ViewChild, signal, computed, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';

import { Subscription, firstValueFrom } from 'rxjs';
import { formatEther } from 'viem';
import { decodeEventLog } from 'viem';

import { environment } from 'src/environments/environment';
import { GlobalState } from '@/models/global-state';
import { LotteryGridItem, LotteryWin, SpinPhase } from '@/models/lottery';
import { PhilipLotteryV67ABI } from '@/abi/PhilipLotteryV67';

import { Web3Service } from '@/services/web3.service';
import { LotteryService } from '@/services/lottery.service';

import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as notifActions from '@/state/actions/notification.actions';


// Build spin path based on grid size
function getSpinPath(count: number): number[] {
  if (count <= 1) return [0];
  if (count <= 4) {
    // Single row: ping-pong (0,1,2,3,2,1)
    const forward = Array.from({ length: count }, (_, i) => i);
    const backward = Array.from({ length: count - 2 }, (_, i) => count - 2 - i);
    return [...forward, ...backward];
  }
  // 2 rows: clockwise — top row L→R, bottom row R→L
  const topRow = Math.min(count, 4);
  const bottomRow = count - topRow;
  const path: number[] = [];
  for (let i = 0; i < topRow; i++) path.push(i);
  for (let i = topRow + bottomRow - 1; i >= topRow; i--) path.push(i);
  return path;
}

const INITIAL_STEP_DELAY = 400;
const DECAY_FACTOR = 1.12;
const MIN_ROTATIONS = 3;
const MAX_STEP_DELAY = 600;

@Component({
  selector: 'app-lottery',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './lottery.component.html',
  styleUrls: ['./lottery.component.scss']
})
export class LotteryComponent implements OnInit, OnDestroy {

  @ViewChild('fireworksCanvas', { static: true }) fireworksCanvas!: ElementRef<HTMLDivElement>;

  connected$ = this.store.select(appStateSelectors.selectConnected);
  address$ = this.store.select(appStateSelectors.selectWalletAddress);

  gridItems = signal<LotteryGridItem[]>(
    Array.from({ length: 8 }, (_, i) => ({
      index: i,
      hashId: '',
      sha: '',
      imageUrl: '/assets/images/lottery/philip.png',
      flipping: false,
      revealed: false,
      rightFacing: false,
    }))
  );
  spinPhase = signal<SpinPhase>('idle');
  activeFrameIndex = signal(-1);
  wonPrize = signal<LotteryWin | null>(null);
  recentWins = signal<LotteryWin[]>([]);
  playPrice = signal('0');
  poolSize = signal(0);
  isActive = signal(true);
  isOwner = signal(false);
  contractBalance = signal('0');
  loadedIn = signal(false);
  buttonShown = signal(false);
  errorMessage = signal('');
  confirmElapsed = signal(0);
  private confirmTimer: any;
  depositStatus = signal('');
  ownedItems = signal<{ hashId: string; sha: string; tokenId: number; slug: string; selected: boolean }[]>([]);
  ownedLoading = signal(false);
  selectedCount = computed(() => this.ownedItems().filter(i => i.selected).length);
  headerImages = computed(() => {
    const items = this.gridItems();
    if (!items.length) {
      const defaultSrc = '/assets/loadingphunk.png';
      return Array.from({ length: 9 }, () => ({ src: defaultSrc }));
    }
    return Array.from({ length: 9 }, (_, i) => ({
      src: items[i % items.length].imageUrl,
    }));
  });

  staticUrl = environment.staticUrl;
  philipFallback = '/assets/images/lottery/philip.png';
  private philipImageUrl = '';

  private recentWinsSub!: Subscription;
  private winWatchSub!: Subscription;
  private spinTimeout: any;
  private spinPath: number[] = getSpinPath(8);
  private currentStepIndex = 0;
  private stepDelay = INITIAL_STEP_DELAY;
  private shouldDecelerate = false;
  private targetWinIndex = -1;
  private fireworks: any = null;
  private playInProgress = false;
  private pendingWinRecord: LotteryWin | null = null;
  private beforeUnloadHandler = (e: BeforeUnloadEvent) => {
    if (this.playInProgress) {
      e.preventDefault();
    }
  };

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
    this.initGrid();
    this.subscribeRecentWins();

    // Check if current user is owner
    const address = await firstValueFrom(this.address$);
    if (address) {
      try {
        const owner = await this.lotterySvc.getOwner();
        this.isOwner.set(owner.toLowerCase() === address.toLowerCase());
        if (this.isOwner()) {
          const balance = await this.lotterySvc.getContractBalance();
          this.contractBalance.set(formatEther(balance));
          this.loadOwnedItems(address);
        }
      } catch {}
    }

    // Staggered load-in animation (matches OG timing)
    setTimeout(() => this.loadedIn.set(true), 300);
    setTimeout(() => this.buttonShown.set(true), 1400);

    // Prevent accidental navigation during play
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  ngOnDestroy() {
    this.recentWinsSub?.unsubscribe();
    this.winWatchSub?.unsubscribe();
    clearTimeout(this.spinTimeout);
    this.stopFireworks();
    window.removeEventListener('beforeunload', this.beforeUnloadHandler);
  }

  // =========================================================
  // Contract State
  // =========================================================

  private async loadContractState() {
    try {
      const [price, active, size] = await Promise.all([
        this.lotterySvc.getPlayPrice(),
        this.lotterySvc.isActive(),
        this.lotterySvc.getPoolSize(),
      ]);
      this.playPrice.set(formatEther(price));
      this.isActive.set(active);
      this.poolSize.set(Number(size));
    } catch (err) {
      console.error('Failed to load contract state:', err);
    }
  }

  // =========================================================
  // Grid Init
  // =========================================================

  private async initGrid() {
    const items: LotteryGridItem[] = [];
    const fallback = this.philipImageUrl || '/assets/images/lottery/philip.png';

    try {
      const size = this.poolSize();
      if (size > 0) {
        // Fetch a larger sample then randomly pick 8 for variety
        const fetchCount = Math.min(size, 50);
        const maxOffset = Math.max(0, size - fetchCount);
        const randomOffset = maxOffset > 0 ? Math.floor(Math.random() * maxOffset) : 0;
        const hashIds = await this.lotterySvc.getPoolItems(randomOffset, fetchCount);

        // Look up all fetched items, dedup by sha, then pick 8 unique
        const ethscriptions = await this.lotterySvc.getEthscriptionsByHashIds(
          hashIds.map(h => h.toLowerCase())
        );

        const seen = new Set<string>();
        const unique = ethscriptions.filter(e => {
          if (!e?.sha || seen.has(e.sha)) return false;
          seen.add(e.sha);
          return true;
        });

        // Shuffle so display order varies each load
        for (let i = unique.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [unique[i], unique[j]] = [unique[j], unique[i]];
        }

        const displayCount = Math.min(unique.length, 8);
        for (let i = 0; i < displayCount; i++) {
          const eth = unique[i];
          items.push({
            index: i,
            hashId: eth?.hashId || '',
            sha: eth?.sha || '',
            imageUrl: eth?.sha
              ? `${this.staticUrl}/static/images/${eth.sha}`
              : fallback,
            flipping: false,
            revealed: false,
            rightFacing: false,
          });
        }
      } else {
        // No pool items, fill with 8 placeholders
        for (let i = 0; i < 8; i++) {
          items.push({
            index: i,
            hashId: '',
            sha: '',
            imageUrl: fallback,
            flipping: false,
            revealed: false,
            rightFacing: false,
          });
        }
      }
    } catch {
      for (let i = 0; i < 8; i++) {
        items.push({
          index: i,
          hashId: '',
          sha: '',
          imageUrl: fallback,
          flipping: false,
          revealed: false,
          rightFacing: false,
        });
      }
    }

    this.spinPath = getSpinPath(items.length);
    this.gridItems.set(items);
  }

  // =========================================================
  // Play Flow
  // =========================================================

  async onPlay() {
    const connected = await firstValueFrom(this.connected$);
    if (!connected) {
      this.web3Svc.connect();
      return;
    }

    if (this.spinPhase() !== 'idle' && this.spinPhase() !== 'won') return;
    if (!this.isActive()) {
      this.errorMessage.set('Lottery is currently inactive');
      return;
    }
    if (this.poolSize() === 0) {
      this.errorMessage.set('No prizes available');
      return;
    }

    this.errorMessage.set('');
    this.wonPrize.set(null);
    this.stopFireworks();
    this.spinPhase.set('loading');
    this.playInProgress = true;

    // Reset grid items to unrevealed
    this.gridItems.update(items =>
      items.map(item => ({ ...item, flipping: false, revealed: false }))
    );

    try {
      // Send transaction
      const hash = await this.lotterySvc.play();
      if (!hash) throw new Error('Transaction failed');

      // Show confirming phase with timer while tx is mined
      this.spinPhase.set('confirming');
      this.confirmElapsed.set(0);
      this.confirmTimer = setInterval(() => {
        this.confirmElapsed.update(v => v + 1);
      }, 1000);

      // Wait for on-chain confirmation
      const receipt = await this.web3Svc.pollReceipt(hash);
      clearInterval(this.confirmTimer);

      // Parse PrizeAwarded event from receipt
      let wonHashId = '';
      let playId = 0;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: PhilipLotteryV67ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'PrizeAwarded') {
            const args = decoded.args as any;
            wonHashId = args.hashId;
            playId = Number(args.playId);
          }
        } catch {}
      }

      // Start spinning immediately — look up winner details in parallel
      this.startSpin();

      // Guarantee minimum spin time before deceleration can start
      const minSpinTime = MIN_ROTATIONS * this.spinPath.length * INITIAL_STEP_DELAY;
      const spinStarted = Date.now();

      // Resolve winner details while spin is running
      let winCellIndex = this.spinPath[
        (wonHashId ? playId : Math.floor(Math.random() * this.spinPath.length)) % this.spinPath.length
      ];

      if (wonHashId) {
        try {
          const ethscriptions = await this.lotterySvc.getEthscriptionsByHashIds([wonHashId.toLowerCase()]);
          const won = ethscriptions[0];

          if (won) {
            // If the won image already exists in the grid, use that cell
            const existingIdx = this.gridItems().findIndex(item => item.sha === won.sha);
            if (existingIdx !== -1) {
              winCellIndex = existingIdx;
            } else {
              // Place won image in target cell
              this.gridItems.update(items =>
                items.map((item, i) =>
                  i === winCellIndex
                    ? { ...item, hashId: won.hashId, sha: won.sha, imageUrl: `${this.staticUrl}/static/images/${won.sha}` }
                    : item
                )
              );
            }

            const address = await firstValueFrom(this.address$);
            const winRecord: LotteryWin = {
              id: 0,
              play_id: playId,
              winner: (address || '').toLowerCase(),
              hash_id: won.hashId,
              sha: won.sha,
              token_id: won.tokenId,
              collection_slug: won.slug,
              transfer_status: 'transferred',
              tx_hash: hash,
              created_at: new Date().toISOString(),
            };

            this.wonPrize.set(winRecord);
            this.pendingWinRecord = winRecord;
          }
        } catch (err) {
          console.error('Failed to look up won ethscription:', err);
        }
      }

      // Wait for minimum spin time before allowing deceleration
      const elapsed = Date.now() - spinStarted;
      if (elapsed < minSpinTime) {
        await new Promise(r => setTimeout(r, minSpinTime - elapsed));
      }

      // Signal deceleration — spin will slow and land on winner
      this.targetWinIndex = winCellIndex;
      this.shouldDecelerate = true;

      // Refresh pool size in background
      this.lotterySvc.getPoolSize().then(newSize => this.poolSize.set(Number(newSize)));

      // Refresh owner balance if applicable
      if (this.isOwner()) {
        this.lotterySvc.getContractBalance().then(balance =>
          this.contractBalance.set(formatEther(balance))
        );
      }

    } catch (err: any) {
      clearInterval(this.confirmTimer);
      this.stopSpin();
      this.spinPhase.set('idle');
      const msg = err?.shortMessage || err?.message || 'Transaction failed';
      this.errorMessage.set(msg);
    } finally {
      this.playInProgress = false;
    }
  }

  // =========================================================
  // Demo Play (pretend animation with real collection items)
  // =========================================================

  async onDemoPlay() {
    if (this.spinPhase() !== 'idle' && this.spinPhase() !== 'won') return;

    this.errorMessage.set('');
    this.wonPrize.set(null);
    this.stopFireworks();
    this.spinPhase.set('loading');

    try {
      // Fetch 8 random items from Supabase for demo
      const demoItems = await this.lotterySvc.getRandomPoolItems(8);
      if (!demoItems.length) {
        this.errorMessage.set('No items found in database');
        this.spinPhase.set('idle');
        return;
      }

      const cellCount = Math.min(demoItems.length, 8);
      const items: LotteryGridItem[] = [];
      for (let i = 0; i < cellCount; i++) {
        const eth = demoItems[i];
        items.push({
          index: i,
          hashId: eth.hashId,
          sha: eth.sha,
          imageUrl: `${this.staticUrl}/static/images/${eth.sha}`,
          flipping: false,
          revealed: false,
          rightFacing: false,
        });
      }

      this.spinPath = getSpinPath(cellCount);
      this.gridItems.set(items);

      // Pick a random winner
      const winIndex = Math.floor(Math.random() * cellCount);
      const winner = demoItems[winIndex];

      // Start spin
      this.startSpin();

      // Simulate "confirmation" after 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Set the winning cell and start deceleration
      const winCellIndex = this.spinPath[winIndex % this.spinPath.length];
      this.gridItems.update(current =>
        current.map((item, i) =>
          i === winCellIndex
            ? { ...item, hashId: winner.hashId, sha: winner.sha, imageUrl: `${this.staticUrl}/static/images/${winner.sha}` }
            : item
        )
      );

      this.targetWinIndex = winCellIndex;
      this.shouldDecelerate = true;

      this.wonPrize.set({
        id: 0,
        play_id: 0,
        winner: 'demo',
        hash_id: winner.hashId,
        sha: winner.sha,
        token_id: winner.tokenId,
        collection_slug: winner.slug,
        transfer_status: 'demo',
        tx_hash: '',
        created_at: new Date().toISOString(),
      });

    } catch (err: any) {
      this.stopSpin();
      this.spinPhase.set('idle');
      this.errorMessage.set(err?.message || 'Demo failed');
    }
  }

  // =========================================================
  // Spin Animation
  // =========================================================

  private startSpin(initialPhase: SpinPhase = 'spinning') {
    this.spinPhase.set(initialPhase);
    this.currentStepIndex = 0;
    this.stepDelay = INITIAL_STEP_DELAY;
    this.shouldDecelerate = false;
    this.targetWinIndex = -1;

    // Reset all flip states for the new spin
    this.gridItems.update(items =>
      items.map(item => ({ ...item, flipping: false, revealed: false, rightFacing: false }))
    );

    this.advanceFrame();
  }

  private advanceFrame() {
    const pathIndex = this.currentStepIndex % this.spinPath.length;
    const cellIndex = this.spinPath[pathIndex];

    this.activeFrameIndex.set(cellIndex);

    // Phase 1: Flip current cell to reveal real image (right-facing first)
    this.gridItems.update(items =>
      items.map((item, i) => ({
        ...item,
        flipping: i === cellIndex,
        rightFacing: i === cellIndex,
        revealed: this.shouldDecelerate && i === this.targetWinIndex && cellIndex === this.targetWinIndex,
      }))
    );

    this.currentStepIndex++;

    // Deceleration logic
    if (this.shouldDecelerate && this.currentStepIndex > MIN_ROTATIONS * this.spinPath.length) {
      this.stepDelay *= DECAY_FACTOR;
      this.spinPhase.set('decelerating');

      // Stop when delay is high enough AND we're on the target cell
      if (this.stepDelay > MAX_STEP_DELAY && cellIndex === this.targetWinIndex) {
        this.onSpinComplete();
        return;
      }
    }

    // Safety: stop after too many steps if no deceleration triggered
    if (this.currentStepIndex > 200) {
      this.onSpinComplete();
      return;
    }

    // Phase 1.5: Mirror from right-facing → left-facing (the "phunk flip")
    const mirrorDelay = Math.min(this.stepDelay * 0.35, 220);
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.ngZone.run(() => {
          if (this.spinPhase() === 'spinning' || this.spinPhase() === 'decelerating') {
            this.gridItems.update(items =>
              items.map(item => ({ ...item, rightFacing: false }))
            );
          }
        });
      }, mirrorDelay);
    });

    // Phase 2: Flip back to left-facing philip before next step
    const flipBackDelay = Math.min(this.stepDelay * 0.7, 450);
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.ngZone.run(() => {
          if (this.spinPhase() === 'spinning' || this.spinPhase() === 'decelerating') {
            this.gridItems.update(items =>
              items.map(item => ({ ...item, flipping: false }))
            );
          }
        });
      }, flipBackDelay);
    });

    // Schedule next step
    this.ngZone.runOutsideAngular(() => {
      this.spinTimeout = setTimeout(() => {
        this.ngZone.run(() => this.advanceFrame());
      }, this.stepDelay);
    });
  }

  private onSpinComplete() {
    // Reveal the winning cell, reset all others
    this.gridItems.update(items =>
      items.map((item, i) => ({
        ...item,
        flipping: false,
        rightFacing: false,
        revealed: i === this.targetWinIndex,
      }))
    );

    this.spinPhase.set('won');
    this.startFireworks();

    // Delay adding to recent wins so fireworks have time to play
    if (this.pendingWinRecord) {
      const record = this.pendingWinRecord;
      this.pendingWinRecord = null;
      setTimeout(() => {
        this.recentWins.update(wins => [record, ...wins]);
      }, 4000);
    }
  }

  private stopSpin() {
    clearTimeout(this.spinTimeout);
    this.activeFrameIndex.set(-1);
    this.gridItems.update(items =>
      items.map(item => ({ ...item, flipping: false }))
    );
  }

  // =========================================================
  // Fireworks
  // =========================================================

  private async startFireworks() {
    try {
      const { Fireworks } = await import('fireworks-js');
      this.fireworks = new Fireworks(this.fireworksCanvas.nativeElement, {
        hue: { min: 0, max: 360 },
        delay: { min: 15, max: 30 },
        rocketsPoint: { min: 50, max: 50 },
        traceSpeed: 2,
        acceleration: 1.05,
        particles: 50,
      });
      this.fireworks.start();

      // Auto-stop after 10 seconds
      setTimeout(() => this.stopFireworks(), 10000);
    } catch (err) {
      console.error('Failed to start fireworks:', err);
    }
  }

  private stopFireworks() {
    if (this.fireworks) {
      this.fireworks.stop();
      this.fireworks = null;
    }
  }

  // =========================================================
  // Recent Wins
  // =========================================================

  private subscribeRecentWins() {
    this.recentWinsSub = this.lotterySvc.fetchRecentWins().subscribe(wins => {
      // Don't update during play — would spoil the reveal before fireworks
      if (!this.playInProgress) {
        this.recentWins.set(wins);
      }
    });
  }

  getWinImageUrl(win: LotteryWin): string {
    if (win.sha) {
      return `${this.staticUrl}/static/images/${win.sha}`;
    }
    return '/assets/images/lottery/philip.png';
  }

  // =========================================================
  // Spin Again (reload page for fresh grid)
  // =========================================================

  onSpinAgain() {
    window.location.reload();
  }

  // =========================================================
  // Owner: Deposit Prizes
  // =========================================================

  async loadOwnedItems(address: string) {
    this.ownedLoading.set(true);
    try {
      const items = await this.lotterySvc.getOwnedEthscriptions(address);
      this.ownedItems.set(items.map(item => ({ ...item, selected: false })));
    } catch (err) {
      console.error('Failed to load owned items:', err);
    } finally {
      this.ownedLoading.set(false);
    }
  }

  toggleItem(hashId: string) {
    this.ownedItems.update(items =>
      items.map(item =>
        item.hashId === hashId ? { ...item, selected: !item.selected } : item
      )
    );
  }

  async onDeposit() {
    const selected = this.ownedItems().filter(i => i.selected);
    if (selected.length === 0) {
      this.depositStatus.set('Select items to transfer');
      return;
    }

    this.depositStatus.set(`Transferring ${selected.length} item(s)...`);

    try {
      const hashIds = selected.map(i => i.hashId);
      const hash = await this.lotterySvc.depositPrizes(hashIds);
      if (hash) {
        this.depositStatus.set('Waiting for confirmation...');
        await this.web3Svc.pollReceipt(hash);
        this.depositStatus.set(`Transferred ${selected.length} item(s)!`);

        // Remove deposited items from owned list
        this.ownedItems.update(items => items.filter(i => !i.selected));

        // Refresh pool size and grid
        const newSize = await this.lotterySvc.getPoolSize();
        this.poolSize.set(Number(newSize));
        this.initGrid();
      }
    } catch (err: any) {
      this.depositStatus.set(err?.shortMessage || err?.message || 'Deposit failed');
    }
  }

  // =========================================================
  // Owner: Withdraw ETH
  // =========================================================

  async onWithdrawETH() {
    try {
      const balance = await this.lotterySvc.getContractBalance();
      if (balance === BigInt(0)) return;

      const address = await firstValueFrom(this.address$);
      if (!address) return;

      const hash = await this.lotterySvc.withdrawETH(balance, address);
      if (hash) {
        await this.web3Svc.pollReceipt(hash);
        const newBalance = await this.lotterySvc.getContractBalance();
        this.contractBalance.set(formatEther(newBalance));
      }
    } catch (err: any) {
      this.errorMessage.set(err?.shortMessage || err?.message || 'Withdraw failed');
    }
  }
}
