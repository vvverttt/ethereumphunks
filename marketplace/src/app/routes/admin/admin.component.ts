import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { formatEther, parseEther } from 'viem';

import { GlobalState } from '@/models/global-state';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import { AdminService } from '@/services/admin.service';
import { environment } from 'src/environments/environment';

type Tab = 'market' | 'auction' | 'points' | 'lottery' | 'evolve' | 'ethsrocks' | 'transfer-all';

interface TransferStep {
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  txHash?: string;
  error?: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
})
export class AdminComponent implements OnInit {

  connected$ = this.store.select(appStateSelectors.selectConnected);
  address$ = this.store.select(appStateSelectors.selectWalletAddress);

  isOwner = signal(false);
  loading = signal(true);
  activeTab = signal<Tab>('market');

  txPending = signal(false);
  txHash = signal('');
  txError = signal('');

  // Market state
  marketPaused = signal(false);
  marketRoyaltyShares = signal<{ receiver: string; bps: bigint }[]>([]);
  marketTotalBps = signal('0');
  marketPointsAddress = signal('');
  // Market inputs
  mSetRoyaltySharesReceivers = '';
  mSetRoyaltySharesBps = '';
  mSetPointsAddress = '';
  mTransferOwnership = '';

  // Auction state
  auctionPaused = signal(false);
  auctionDuration = signal('0');
  auctionTimeBuffer = signal('0');
  auctionMinBidPct = signal(0);
  auctionReservePrice = signal('0');
  auctionPointsAddress = signal('');
  auctionTreasuryAddress = signal('');
  auctionPoolSize = signal('0');
  auctionBalance = signal('0');
  // Auction inputs
  aSetDuration = '';
  aSetTimeBuffer = '';
  aSetMinBidPct = '';
  aSetReservePrice = '';
  aSetPointsAddress = '';
  aSetTreasuryAddress = '';
  aWithdrawAmount = '';
  aWithdrawTo = '';
  aWithdrawPoolHashId = '';
  aEmergencyHashId = '';
  aDepositHashIds = '';
  aTransferOwnership = '';

  // Points state
  pointsMultiplier = signal('0');
  pointsPaused = signal(false);
  // Points inputs
  pSetMultiplier = '';
  pGrantManager = '';
  pRevokeManager = '';
  pRemovePointsUser = '';
  pRemovePointsAmount = '';
  pDrainUser = '';

  // Lottery state
  adminLotteryTier = signal<'standard' | 'premium'>('standard');
  lotteryPaused = signal(false);
  lotteryActive = signal(false);
  lotteryPlayPrice = signal('0');
  lotteryBalance = signal('0');
  lotteryPointsAddress = signal('');
  lotteryTreasuryAddress = signal('');
  lotteryPoolSize = signal('0');
  // Lottery inputs
  lSetPrice = '';
  lSetPointsAddress = '';
  lSetTreasuryAddress = '';
  lWithdrawAmount = '';
  lWithdrawTo = '';
  lWithdrawPrizeHashId = '';
  lTransferOwnership = '';

  // Evolve state
  evolvePaused = signal(false);
  evolveFee = signal('0');
  evolvePairCount = signal('0');
  // Evolve inputs
  eSetFee = '';
  eWithdrawHashId = '';
  eWithdrawTo = '';
  eTransferOwnership = '';

  // EthsRocks state
  ethsrocksPaused = signal(false);
  ethsrocksPoolSize = signal('0');
  ethsrocksBalance = signal('0');
  ethsrocksPrice = signal('0');
  ethsrocksTotalRevealed = signal('0');
  ethsrocksPendingReveals = signal('0');
  ethsrocksSignerAddress = signal('');
  ethsrocksTreasuryAddress = signal('');
  ethsrocksPointsAddress = signal('');
  // EthsRocks inputs
  rSetSignerAddress = '';
  rSetTreasuryAddress = '';
  rSetPointsAddress = '';
  rWithdrawAmount = '';
  rWithdrawTo = '';
  rWithdrawPoolHashId = '';
  rEmergencyHashId = '';
  rDepositHashIds = '';
  rTransferOwnership = '';

  // Batch operations (pause/unpause all, transfer all)
  batchRunning = signal(false);
  batchSteps = signal<TransferStep[]>([]);
  transferAllAddress = '';
  transferAllRunning = signal(false);
  transferAllSteps = signal<TransferStep[]>([]);

  explorerUrl = (environment as any).explorerUrl || 'https://etherscan.io';

  constructor(
    private store: Store<GlobalState>,
    public adminSvc: AdminService,
  ) {}

  async ngOnInit() {
    const address = await firstValueFrom(this.address$);
    if (!address) {
      this.loading.set(false);
      return;
    }

    try {
      const marketOwner = await this.adminSvc.getMarketOwner();
      if (marketOwner.toLowerCase() === address.toLowerCase()) {
        this.isOwner.set(true);
        await this.loadAllState();
      }
    } catch (e) {
      console.error('Admin check failed:', e);
    }
    this.loading.set(false);
  }

  async loadAllState() {
    await Promise.all([
      this.loadMarketState(),
      this.loadAuctionState(),
      this.loadPointsState(),
      this.loadLotteryState(),
      this.loadEvolveState(),
      this.loadEthsRocksState(),
    ]);
  }

  async loadMarketState() {
    try {
      const [paused, shares, totalBps, pts] = await Promise.all([
        this.adminSvc.getMarketPaused(),
        this.adminSvc.getMarketRoyaltyShares(),
        this.adminSvc.getMarketTotalRoyaltyBps(),
        this.adminSvc.getMarketPointsAddress(),
      ]);
      this.marketPaused.set(paused);
      this.marketRoyaltyShares.set(shares);
      this.marketTotalBps.set(totalBps.toString());
      this.marketPointsAddress.set(pts);
    } catch (e) { console.error('Market state error:', e); }
  }

  async loadAuctionState() {
    try {
      const [paused, duration, buffer, pct, reserve, pts, treasury, poolSize, balance] = await Promise.all([
        this.adminSvc.getAuctionPaused(),
        this.adminSvc.getAuctionDuration(),
        this.adminSvc.getAuctionTimeBuffer(),
        this.adminSvc.getAuctionMinBidIncrement(),
        this.adminSvc.getAuctionReservePrice(),
        this.adminSvc.getAuctionPointsAddress(),
        this.adminSvc.getAuctionTreasuryAddress(),
        this.adminSvc.getAuctionPoolSize(),
        this.adminSvc.getAuctionBalance(),
      ]);
      this.auctionPaused.set(paused);
      this.auctionDuration.set(duration.toString());
      this.auctionTimeBuffer.set(buffer.toString());
      this.auctionMinBidPct.set(pct);
      this.auctionReservePrice.set(formatEther(reserve));
      this.auctionPointsAddress.set(pts);
      this.auctionTreasuryAddress.set(treasury);
      this.auctionPoolSize.set(poolSize.toString());
      this.auctionBalance.set(formatEther(balance));
    } catch (e) { console.error('Auction state error:', e); }
  }

  async loadPointsState() {
    try {
      const [multiplier, paused] = await Promise.all([
        this.adminSvc.getPointsMultiplier(),
        this.adminSvc.getPointsPaused(),
      ]);
      this.pointsMultiplier.set(multiplier.toString());
      this.pointsPaused.set(paused);
    } catch (e) { console.error('Points state error:', e); }
  }

  async loadLotteryState() {
    try {
      const [paused, active, price, balance, pts, treasury, poolSize] = await Promise.all([
        this.adminSvc.getLotteryPaused(),
        this.adminSvc.getLotteryActive(),
        this.adminSvc.getLotteryPlayPrice(),
        this.adminSvc.getLotteryBalance(),
        this.adminSvc.getLotteryPointsAddress(),
        this.adminSvc.getLotteryTreasuryAddress(),
        this.adminSvc.getLotteryPoolSize(),
      ]);
      this.lotteryPaused.set(paused);
      this.lotteryActive.set(active);
      this.lotteryPlayPrice.set(formatEther(price));
      this.lotteryBalance.set(formatEther(balance));
      this.lotteryPointsAddress.set(pts);
      this.lotteryTreasuryAddress.set(treasury);
      this.lotteryPoolSize.set(poolSize.toString());
    } catch (e) { console.error('Lottery state error:', e); }
  }

  async loadEvolveState() {
    try {
      const [paused, fee, pairs] = await Promise.all([
        this.adminSvc.getEvolvePaused(),
        this.adminSvc.getEvolveFee(),
        this.adminSvc.getEvolvePairCount(),
      ]);
      this.evolvePaused.set(paused);
      this.evolveFee.set(formatEther(fee));
      this.evolvePairCount.set(pairs.toString());
    } catch (e) { console.error('Evolve state error:', e); }
  }

  async loadEthsRocksState() {
    try {
      const [paused, poolSize, balance, price, revealed, pending, signer, treasury, pts] = await Promise.all([
        this.adminSvc.getEthsRocksPaused(),
        this.adminSvc.getEthsRocksPoolSize(),
        this.adminSvc.getEthsRocksBalance(),
        this.adminSvc.getEthsRocksPrice(),
        this.adminSvc.getEthsRocksTotalRevealed(),
        this.adminSvc.getEthsRocksPendingReveals(),
        this.adminSvc.getEthsRocksSignerAddress(),
        this.adminSvc.getEthsRocksTreasuryAddress(),
        this.adminSvc.getEthsRocksPointsAddress(),
      ]);
      this.ethsrocksPaused.set(paused);
      this.ethsrocksPoolSize.set(poolSize.toString());
      this.ethsrocksBalance.set(formatEther(balance));
      this.ethsrocksPrice.set(formatEther(price));
      this.ethsrocksTotalRevealed.set(revealed.toString());
      this.ethsrocksPendingReveals.set(pending.toString());
      this.ethsrocksSignerAddress.set(signer);
      this.ethsrocksTreasuryAddress.set(treasury);
      this.ethsrocksPointsAddress.set(pts);
    } catch (e) { console.error('EthsRocks state error:', e); }
  }

  // =========================================================
  // Execute helper
  // =========================================================

  async exec(fn: () => Promise<any>, reloadFn?: () => Promise<void>) {
    this.txPending.set(true);
    this.txHash.set('');
    this.txError.set('');
    try {
      const hash = await fn();
      this.txHash.set(hash || '');
      if (reloadFn) await reloadFn();
    } catch (e: any) {
      this.txError.set(e?.shortMessage || e?.message || 'Transaction failed');
    } finally {
      this.txPending.set(false);
    }
  }

  // Market actions
  toggleMarketPause() {
    this.exec(
      () => this.marketPaused() ? this.adminSvc.marketUnpause() : this.adminSvc.marketPause(),
      () => this.loadMarketState()
    );
  }
  setMarketRoyaltyShares() {
    const receivers = this.mSetRoyaltySharesReceivers.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('0x'));
    const bps = this.mSetRoyaltySharesBps.split(/[\n,]+/).map(s => BigInt(s.trim())).filter(b => b > 0n);
    if (!receivers.length || receivers.length !== bps.length) return;
    this.exec(() => this.adminSvc.marketSetRoyaltyShares(receivers, bps), () => this.loadMarketState());
  }
  setMarketPointsAddress() { this.exec(() => this.adminSvc.marketSetPointsAddress(this.mSetPointsAddress), () => this.loadMarketState()); }
  transferMarketOwnership() { this.exec(() => this.adminSvc.marketTransferOwnership(this.mTransferOwnership)); }

  // Auction actions
  toggleAuctionPause() {
    this.exec(
      () => this.auctionPaused() ? this.adminSvc.auctionUnpause() : this.adminSvc.auctionPause(),
      () => this.loadAuctionState()
    );
  }
  setAuctionDuration() { this.exec(() => this.adminSvc.auctionSetDuration(BigInt(this.aSetDuration)), () => this.loadAuctionState()); }
  setAuctionTimeBuffer() { this.exec(() => this.adminSvc.auctionSetTimeBuffer(BigInt(this.aSetTimeBuffer)), () => this.loadAuctionState()); }
  setAuctionMinBidPct() { this.exec(() => this.adminSvc.auctionSetMinBidIncrementPercentage(Number(this.aSetMinBidPct)), () => this.loadAuctionState()); }
  setAuctionReservePrice() { this.exec(() => this.adminSvc.auctionSetReservePrice(parseEther(this.aSetReservePrice)), () => this.loadAuctionState()); }
  setAuctionPointsAddress() { this.exec(() => this.adminSvc.auctionSetPointsAddress(this.aSetPointsAddress), () => this.loadAuctionState()); }
  setAuctionTreasuryAddress() { this.exec(() => this.adminSvc.auctionSetTreasuryAddress(this.aSetTreasuryAddress), () => this.loadAuctionState()); }
  async auctionWithdrawAllETH() {
    const address = await firstValueFrom(this.address$);
    if (!address) return;
    this.exec(async () => {
      const balance = await this.adminSvc.getAuctionBalance();
      return this.adminSvc.auctionWithdrawETH(balance, address);
    }, () => this.loadAuctionState());
  }
  auctionWithdrawETH() { this.exec(() => this.adminSvc.auctionWithdrawETH(parseEther(this.aWithdrawAmount), this.aWithdrawTo), () => this.loadAuctionState()); }
  auctionWithdrawFromPool() { this.exec(() => this.adminSvc.auctionWithdrawFromPool(this.aWithdrawPoolHashId), () => this.loadAuctionState()); }
  auctionEmergencyWithdraw() { this.exec(() => this.adminSvc.auctionEmergencyWithdrawEthscription(this.aEmergencyHashId)); }
  auctionDepositEthscriptions() {
    const hashIds = this.aDepositHashIds.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('0x'));
    if (!hashIds.length) return;
    this.exec(() => this.adminSvc.auctionDepositEthscriptions(hashIds), () => this.loadAuctionState());
  }
  transferAuctionOwnership() { this.exec(() => this.adminSvc.auctionTransferOwnership(this.aTransferOwnership)); }

  // Points actions
  setPointsMultiplier() { this.exec(() => this.adminSvc.pointsChangeMultiplier(BigInt(this.pSetMultiplier)), () => this.loadPointsState()); }
  grantPointsManager() { this.exec(() => this.adminSvc.pointsGrantManager(this.pGrantManager)); }
  revokePointsManager() { this.exec(() => this.adminSvc.pointsRevokeManager(this.pRevokeManager)); }
  removePoints() { this.exec(() => this.adminSvc.pointsRemovePoints(this.pRemovePointsUser, BigInt(this.pRemovePointsAmount))); }
  drainPoints() { this.exec(() => this.adminSvc.pointsDrainPoints(this.pDrainUser)); }

  // Lottery actions
  get hasSecondLottery(): boolean { return this.adminSvc.hasSecondLottery; }

  switchAdminLottery(tier: 'standard' | 'premium') {
    this.adminLotteryTier.set(tier);
    this.adminSvc.setLotteryAddress(
      tier === 'premium' ? this.adminSvc.premiumLotteryAddress : this.adminSvc.standardLotteryAddress
    );
    this.loadLotteryState();
  }

  toggleLotteryPause() {
    this.exec(
      () => this.lotteryPaused() ? this.adminSvc.lotteryUnpause() : this.adminSvc.lotteryPause(),
      () => this.loadLotteryState()
    );
  }
  toggleLotteryActive() {
    this.exec(
      () => this.adminSvc.lotterySetActive(!this.lotteryActive()),
      () => this.loadLotteryState()
    );
  }
  setLotteryPrice() { this.exec(() => this.adminSvc.lotterySetPrice(parseEther(this.lSetPrice)), () => this.loadLotteryState()); }
  setLotteryPointsAddress() { this.exec(() => this.adminSvc.lotterySetPointsAddress(this.lSetPointsAddress), () => this.loadLotteryState()); }
  setLotteryTreasuryAddress() { this.exec(() => this.adminSvc.lotterySetTreasuryAddress(this.lSetTreasuryAddress), () => this.loadLotteryState()); }
  async lotteryWithdrawAllETH() {
    const address = await firstValueFrom(this.address$);
    if (!address) return;
    this.exec(async () => {
      const balance = await this.adminSvc.getLotteryBalance();
      return this.adminSvc.lotteryWithdrawETH(balance, address);
    }, () => this.loadLotteryState());
  }
  lotteryWithdrawETH() { this.exec(() => this.adminSvc.lotteryWithdrawETH(parseEther(this.lWithdrawAmount), this.lWithdrawTo), () => this.loadLotteryState()); }
  lotteryWithdrawPrize() { this.exec(() => this.adminSvc.lotteryWithdrawPrize(this.lWithdrawPrizeHashId)); }
  async lotteryWithdrawAllPrizes() {
    this.exec(async () => {
      const size = await this.adminSvc.getLotteryPoolSize();
      if (size === 0n) throw new Error('Pool is empty');
      const items = await this.adminSvc.getLotteryPoolItems(0n, size);
      return this.adminSvc.lotteryWithdrawPrizeBatch(items as string[]);
    }, () => this.loadLotteryState());
  }
  transferLotteryOwnership() { this.exec(() => this.adminSvc.lotteryTransferOwnership(this.lTransferOwnership)); }

  // Evolve actions
  toggleEvolvePause() {
    this.exec(
      () => this.evolvePaused() ? this.adminSvc.evolveUnpause() : this.adminSvc.evolvePause(),
      () => this.loadEvolveState()
    );
  }
  setEvolveFee() { this.exec(() => this.adminSvc.evolveSetFee(parseEther(this.eSetFee)), () => this.loadEvolveState()); }
  evolveWithdrawETH() { this.exec(() => this.adminSvc.evolveWithdrawETH(), () => this.loadEvolveState()); }
  evolveWithdrawEthscription() { this.exec(() => this.adminSvc.evolveWithdrawEthscription(this.eWithdrawHashId, this.eWithdrawTo)); }
  transferEvolveOwnership() { this.exec(() => this.adminSvc.evolveTransferOwnership(this.eTransferOwnership)); }

  // EthsRocks actions
  toggleEthsRocksPause() {
    this.exec(
      () => this.ethsrocksPaused() ? this.adminSvc.ethsrocksUnpause() : this.adminSvc.ethsrocksPause(),
      () => this.loadEthsRocksState()
    );
  }
  setEthsRocksSignerAddress() { this.exec(() => this.adminSvc.ethsrocksSetSignerAddress(this.rSetSignerAddress), () => this.loadEthsRocksState()); }
  setEthsRocksTreasuryAddress() { this.exec(() => this.adminSvc.ethsrocksSetTreasuryAddress(this.rSetTreasuryAddress), () => this.loadEthsRocksState()); }
  setEthsRocksPointsAddress() { this.exec(() => this.adminSvc.ethsrocksSetPointsAddress(this.rSetPointsAddress), () => this.loadEthsRocksState()); }
  async ethsrocksWithdrawAllETH() {
    const address = await firstValueFrom(this.address$);
    if (!address) return;
    this.exec(async () => {
      const balance = await this.adminSvc.getEthsRocksBalance();
      return this.adminSvc.ethsrocksWithdrawETH(balance, address);
    }, () => this.loadEthsRocksState());
  }
  ethsrocksWithdrawETH() { this.exec(() => this.adminSvc.ethsrocksWithdrawETH(parseEther(this.rWithdrawAmount), this.rWithdrawTo), () => this.loadEthsRocksState()); }
  ethsrocksWithdrawFromPool() { this.exec(() => this.adminSvc.ethsrocksWithdrawFromPool(this.rWithdrawPoolHashId), () => this.loadEthsRocksState()); }
  ethsrocksEmergencyWithdraw() { this.exec(() => this.adminSvc.ethsrocksEmergencyWithdrawEthscription(this.rEmergencyHashId)); }
  ethsrocksDepositEthscriptions() {
    const hashIds = this.rDepositHashIds.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('0x'));
    if (!hashIds.length) return;
    this.exec(() => this.adminSvc.ethsrocksDepositEthscriptions(hashIds), () => this.loadEthsRocksState());
  }
  transferEthsRocksOwnership() { this.exec(() => this.adminSvc.ethsrocksTransferOwnership(this.rTransferOwnership)); }

  // Pause All (Market, Auction, Lottery, Evolve, EthsRocks)
  async pauseAll() {
    this.batchRunning.set(true);
    const steps: TransferStep[] = [
      { label: 'Market — pause', status: 'pending' },
      { label: 'Auction — pause', status: 'pending' },
      { label: 'Lottery (Standard) — pause', status: 'pending' },
      ...(this.hasSecondLottery ? [{ label: 'Lottery (Premium) — pause', status: 'pending' as const }] : []),
      { label: 'Evolve — pause', status: 'pending' },
      { label: 'EthsRocks — pause', status: 'pending' },
    ];
    this.batchSteps.set([...steps]);

    const fns: (() => Promise<any>)[] = [
      () => this.adminSvc.marketPause(),
      () => this.adminSvc.auctionPause(),
      () => { this.adminSvc.setLotteryAddress(this.adminSvc.standardLotteryAddress); return this.adminSvc.lotteryPause(); },
      ...(this.hasSecondLottery ? [() => { this.adminSvc.setLotteryAddress(this.adminSvc.premiumLotteryAddress); return this.adminSvc.lotteryPause(); }] : []),
      () => this.adminSvc.evolvePause(),
      () => this.adminSvc.ethsrocksPause(),
    ];

    for (let i = 0; i < fns.length; i++) {
      steps[i].status = 'running';
      this.batchSteps.set([...steps]);
      try {
        const hash = await fns[i]();
        steps[i].status = 'done';
        steps[i].txHash = hash;
      } catch (e: any) {
        steps[i].status = 'error';
        steps[i].error = e?.shortMessage || e?.message || 'Failed';
        this.batchSteps.set([...steps]);
        this.batchRunning.set(false);
        return;
      }
      this.batchSteps.set([...steps]);
    }

    this.batchRunning.set(false);
    await this.loadAllState();
  }

  // Unpause All (Market, Auction, Lottery, Evolve, EthsRocks)
  async unpauseAll() {
    this.batchRunning.set(true);
    const steps: TransferStep[] = [
      { label: 'Market — unpause', status: 'pending' },
      { label: 'Auction — unpause', status: 'pending' },
      { label: 'Lottery (Standard) — unpause', status: 'pending' },
      ...(this.hasSecondLottery ? [{ label: 'Lottery (Premium) — unpause', status: 'pending' as const }] : []),
      { label: 'Evolve — unpause', status: 'pending' },
      { label: 'EthsRocks — unpause', status: 'pending' },
    ];
    this.batchSteps.set([...steps]);

    const fns: (() => Promise<any>)[] = [
      () => this.adminSvc.marketUnpause(),
      () => this.adminSvc.auctionUnpause(),
      () => { this.adminSvc.setLotteryAddress(this.adminSvc.standardLotteryAddress); return this.adminSvc.lotteryUnpause(); },
      ...(this.hasSecondLottery ? [() => { this.adminSvc.setLotteryAddress(this.adminSvc.premiumLotteryAddress); return this.adminSvc.lotteryUnpause(); }] : []),
      () => this.adminSvc.evolveUnpause(),
      () => this.adminSvc.ethsrocksUnpause(),
    ];

    for (let i = 0; i < fns.length; i++) {
      steps[i].status = 'running';
      this.batchSteps.set([...steps]);
      try {
        const hash = await fns[i]();
        steps[i].status = 'done';
        steps[i].txHash = hash;
      } catch (e: any) {
        steps[i].status = 'error';
        steps[i].error = e?.shortMessage || e?.message || 'Failed';
        this.batchSteps.set([...steps]);
        this.batchRunning.set(false);
        return;
      }
      this.batchSteps.set([...steps]);
    }

    this.batchRunning.set(false);
    await this.loadAllState();
  }

  // Transfer All contracts + proxies
  async transferAll() {
    const newOwner = this.transferAllAddress.trim();
    if (!newOwner || !newOwner.startsWith('0x')) return;

    const address = await firstValueFrom(this.address$);
    if (!address) return;

    this.transferAllRunning.set(true);

    const steps: TransferStep[] = [
      { label: 'Market — transferOwnership', status: 'pending' },
      { label: 'Auction — transferOwnership', status: 'pending' },
      { label: 'Lottery (Standard) — transferOwnership', status: 'pending' },
      ...(this.hasSecondLottery ? [{ label: 'Lottery (Premium) — transferOwnership', status: 'pending' as const }] : []),
      { label: 'Evolve — transferOwnership', status: 'pending' },
      { label: 'EthsRocks — transferOwnership', status: 'pending' },
      { label: 'Points — grantRole(DEFAULT_ADMIN_ROLE)', status: 'pending' },
      { label: 'Points — revokeRole(DEFAULT_ADMIN_ROLE)', status: 'pending' },
      { label: 'Market ProxyAdmin — transferOwnership', status: 'pending' },
      { label: 'Auction ProxyAdmin — transferOwnership', status: 'pending' },
      { label: 'Evolve ProxyAdmin — transferOwnership', status: 'pending' },
      { label: 'EthsRocks ProxyAdmin — transferOwnership', status: 'pending' },
      { label: 'Lottery (Standard) ProxyAdmin — transferOwnership', status: 'pending' },
      ...(this.hasSecondLottery ? [{ label: 'Lottery (Premium) ProxyAdmin — transferOwnership', status: 'pending' as const }] : []),
    ];
    this.transferAllSteps.set([...steps]);

    const fns: (() => Promise<any>)[] = [
      () => this.adminSvc.marketTransferOwnership(newOwner),
      () => this.adminSvc.auctionTransferOwnership(newOwner),
      () => { this.adminSvc.setLotteryAddress(this.adminSvc.standardLotteryAddress); return this.adminSvc.lotteryTransferOwnership(newOwner); },
      ...(this.hasSecondLottery ? [() => { this.adminSvc.setLotteryAddress(this.adminSvc.premiumLotteryAddress); return this.adminSvc.lotteryTransferOwnership(newOwner); }] : []),
      () => this.adminSvc.evolveTransferOwnership(newOwner),
      () => this.adminSvc.ethsrocksTransferOwnership(newOwner),
      () => this.adminSvc.pointsGrantAdminRole(newOwner),
      () => this.adminSvc.pointsRevokeAdminRole(address),
      () => this.adminSvc.marketProxyAdminTransfer(newOwner),
      () => this.adminSvc.auctionProxyAdminTransfer(newOwner),
      () => this.adminSvc.evolveProxyAdminTransfer(newOwner),
      () => this.adminSvc.ethsrocksProxyAdminTransfer(newOwner),
      () => this.adminSvc.lotteryProxyAdminTransfer(newOwner),
      ...(this.hasSecondLottery ? [() => this.adminSvc.lottery2ProxyAdminTransfer(newOwner)] : []),
    ];

    for (let i = 0; i < fns.length; i++) {
      steps[i].status = 'running';
      this.transferAllSteps.set([...steps]);

      try {
        const hash = await fns[i]();
        steps[i].status = 'done';
        steps[i].txHash = hash;
      } catch (e: any) {
        steps[i].status = 'error';
        steps[i].error = e?.shortMessage || e?.message || 'Failed';
        // Stop on error — don't continue with remaining steps
        this.transferAllSteps.set([...steps]);
        this.transferAllRunning.set(false);
        return;
      }
      this.transferAllSteps.set([...steps]);
    }

    this.transferAllRunning.set(false);
  }
}
