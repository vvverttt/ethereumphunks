import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { formatEther, parseEther } from 'viem';

import { GlobalState } from '@/models/global-state';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';
import * as appStateActions from '@/state/actions/app-state.actions';
import { AdminService } from '@/services/admin.service';
import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';
import { environment } from 'src/environments/environment';
import { supabase } from '@/services/supabase';
import { isAdminWallet } from '@/constants/admin-wallets';

type Tab = 'market' | 'auction' | 'lottery' | 'evolve' | 'visibility' | 'phunkquidity' | 'transfer-all' | 'health';

interface PhunkquidityCollectionRow {
  name: string;
  slugStr: string;
  pointValue: number;
  enabled: boolean;
  inputDisabled: boolean;
  newPointValue: number;
}

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
  auctionOrderSize = signal('0');
  auctionOrderItems = signal<string[]>([]);
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
  aWithdrawPoolBatch = '';
  aEmergencyHashId = '';
  aEmergencyBatch = '';
  aDepositHashIds = '';
  aTransferOwnership = '';
  aSetItemReserveHashIds = '';
  aSetItemReservePrices = '';
  aSetAuctionOrderHashIds = '';

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
  lEmergencyHashId = '';
  lRedirectFrom = '';
  lRedirectTo = '';
  lCheckPendingAddr = '';
  lotteryPendingReturns = signal('');
  lotteryTotalCommittedETH = signal('0');

  // Evolve state
  evolvePaused = signal(false);
  evolveFee = signal('0');
  evolvePairCount = signal('0');
  // Evolve inputs
  eSetFee = '';
  eWithdrawHashId = '';
  eWithdrawTo = '';
  eTransferOwnership = '';
  eRegisterOgHashes = '';
  eRegisterQuantumHashes = '';

  // Visibility state
  maintenanceMode = signal(false);
  adminPreview = signal(false);
  showMutate = signal(true);
  showDevolve = signal(true);
  showLottery = signal(true);
  showAuction = signal(true);
  showPhunkSwap = signal(true);
  showPhunkquidity = signal(true);
  hiddenSlugs = signal<string[]>([]);
  visHiddenSlugsInput = '';

  // Collection Trait Filter presets (admin-controlled, applied globally per collection)
  objectKeys = Object.keys;
  readonly ctfSlugs = ['cryptophunksv67', 'quantummissingphunksv67', 'quantumdystophunkzv67'] as const;
  readonly ctfSlugLabels: Record<string, string> = {
    'cryptophunksv67': 'CryptoPhunksV67',
    'quantummissingphunksv67': 'Quantum Missing Phunks',
    'quantumdystophunkzv67': 'Quantum DystoPhunkz',
  };
  traitOptions = signal<{ [slug: string]: { [k: string]: string[] } }>({});
  traitSelections = signal<{ [slug: string]: { [k: string]: string } }>({});
  traitOptionsLoading = signal(false);

  // Phunkquidity admin
  phunkquidityOwner = signal('');
  pqWithdrawSlug = 'cryptophunksv67';
  pqWithdrawHashId = '';
  phunkquidityCollections = signal<PhunkquidityCollectionRow[]>([
    { name: 'Philip Intern',    slugStr: 'philip-intern',     pointValue: 0, enabled: false, inputDisabled: false, newPointValue: 0 },
    { name: 'V1 Phunks',        slugStr: 'v1-phunks',         pointValue: 0, enabled: false, inputDisabled: false, newPointValue: 0 },
    { name: 'V2 Phunks',        slugStr: 'v2-phunks',         pointValue: 0, enabled: false, inputDisabled: false, newPointValue: 0 },
    { name: 'V3 Phunks',        slugStr: 'v3-phunks',         pointValue: 0, enabled: false, inputDisabled: false, newPointValue: 0 },
    { name: 'Pepephunks',       slugStr: 'pepephunks',        pointValue: 0, enabled: false, inputDisabled: false, newPointValue: 0 },
    { name: 'Skelephunks',      slugStr: 'skelephunks',       pointValue: 0, enabled: false, inputDisabled: false, newPointValue: 0 },
    { name: 'Etherphunks',      slugStr: 'etherphunks',       pointValue: 0, enabled: false, inputDisabled: false, newPointValue: 0 },
    { name: 'Missing Phunks',   slugStr: 'og-missing-phunks', pointValue: 0, enabled: false, inputDisabled: false, newPointValue: 0 },
    { name: 'Dystophunks',      slugStr: 'og-dysto-phunks',   pointValue: 0, enabled: false, inputDisabled: false, newPointValue: 0 },
    { name: 'CryptoPhunksV67',  slugStr: 'cryptophunksv67',   pointValue: 0, enabled: false, inputDisabled: false, newPointValue: 0 },
  ]);

  // Health check
  healthChecking = signal(false);
  healthResults = signal<{ name: string; url: string; status: 'ok' | 'error' | 'pending'; blockNumber?: string; latency?: number; error?: string; }[]>([]);

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
    private dataSvc: DataService,
    private web3Svc: Web3Service,
  ) {}

  async ngOnInit() {
    const address = await firstValueFrom(this.address$);
    if (!address) {
      this.loading.set(false);
      return;
    }

    try {
      const marketOwner = await this.adminSvc.getMarketOwner();
      const isOwner = marketOwner.toLowerCase() === address.toLowerCase() || isAdminWallet(address);
      if (isOwner) {
        this.isOwner.set(true);
        await this.loadAllState();
      }
    } catch (e) {
      console.error('Admin check failed:', e);
      if (isAdminWallet(address)) {
        this.isOwner.set(true);
        await this.loadAllState();
      }
    }
    this.loading.set(false);
  }

  async loadAllState() {
    await Promise.all([
      this.loadMarketState(),
      this.loadAuctionState(),
      this.loadLotteryState(),
      this.loadEvolveState(),
      this.loadVisibility(),
      this.loadPhunkquidityState(),
    ]);
  }

  async loadPhunkquidityState() {
    try {
      this.phunkquidityOwner.set(await this.adminSvc.getPhunkquidityOwner());
      const rows = [...this.phunkquidityCollections()];
      await Promise.all(rows.map(async (row) => {
        try {
          const c = await this.adminSvc.getPhunkquidityCollection(row.slugStr);
          row.pointValue = Number(c.pointValue);
          row.enabled = c.enabled;
          row.newPointValue = Number(c.pointValue);
          row.inputDisabled = await this.adminSvc.getPhunkquidityInputDisabled(row.slugStr);
        } catch {}
      }));
      this.phunkquidityCollections.set(rows);
    } catch (e) {
      console.error('Failed to load Phunkquidity state:', e);
    }
  }

  async togglePhunkquidityInputDisabled(row: PhunkquidityCollectionRow) {
    this.txPending.set(true);
    this.txError.set('');
    this.txHash.set('');
    try {
      const hash = await this.adminSvc.setPhunkquidityInputDisabled(row.slugStr, !row.inputDisabled);
      this.txHash.set(hash);
      await this.loadPhunkquidityState();
    } catch (e: any) {
      this.txError.set(e?.shortMessage || e?.message || 'Failed');
    } finally {
      this.txPending.set(false);
    }
  }

  phunkquidityWithdrawEthsc() {
    const hashId = this.pqWithdrawHashId.trim();
    if (!hashId.startsWith('0x') || hashId.length !== 66) {
      this.txError.set('Invalid hashId (must be 0x + 64 hex chars)');
      return;
    }
    this.exec(() => this.adminSvc.phunkquidityWithdrawEthsc(this.pqWithdrawSlug, [hashId]));
  }

  async savePhunkquidityCollection(row: PhunkquidityCollectionRow) {
    if (row.newPointValue <= 0) { this.txError.set('Point value must be > 0'); return; }
    this.txPending.set(true);
    this.txError.set('');
    this.txHash.set('');
    try {
      const hash = await this.adminSvc.updatePhunkquidityCollection(row.slugStr, row.newPointValue, row.enabled);
      this.txHash.set(hash);
      await this.loadPhunkquidityState();
    } catch (e: any) {
      this.txError.set(e?.shortMessage || e?.message || 'Failed');
    } finally {
      this.txPending.set(false);
    }
  }

  async togglePhunkquidityEnabled(row: PhunkquidityCollectionRow) {
    this.txPending.set(true);
    this.txError.set('');
    this.txHash.set('');
    try {
      const hash = await this.adminSvc.updatePhunkquidityCollection(row.slugStr, row.pointValue, !row.enabled);
      this.txHash.set(hash);
      await this.loadPhunkquidityState();
    } catch (e: any) {
      this.txError.set(e?.shortMessage || e?.message || 'Failed');
    } finally {
      this.txPending.set(false);
    }
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
      const [paused, duration, buffer, pct, reserve, pts, treasury, poolSize, balance, orderSize, orderItems] = await Promise.all([
        this.adminSvc.getAuctionPaused(),
        this.adminSvc.getAuctionDuration(),
        this.adminSvc.getAuctionTimeBuffer(),
        this.adminSvc.getAuctionMinBidIncrement(),
        this.adminSvc.getAuctionReservePrice(),
        this.adminSvc.getAuctionPointsAddress(),
        this.adminSvc.getAuctionTreasuryAddress(),
        this.adminSvc.getAuctionPoolSize(),
        this.adminSvc.getAuctionBalance(),
        this.adminSvc.getAuctionOrderSize(),
        this.adminSvc.getAuctionOrderItems(),
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
      this.auctionOrderSize.set(orderSize.toString());
      this.auctionOrderItems.set(orderItems);
    } catch (e) { console.error('Auction state error:', e); }
  }

  async loadLotteryState() {
    try {
      const [paused, active, price, balance, pts, treasury, poolSize, committedETH] = await Promise.all([
        this.adminSvc.getLotteryPaused(),
        this.adminSvc.getLotteryActive(),
        this.adminSvc.getLotteryPlayPrice(),
        this.adminSvc.getLotteryBalance(),
        this.adminSvc.getLotteryPointsAddress(),
        this.adminSvc.getLotteryTreasuryAddress(),
        this.adminSvc.getLotteryPoolSize(),
        this.adminSvc.lotteryGetTotalCommittedETH(),
      ]);
      this.lotteryPaused.set(paused);
      this.lotteryActive.set(active);
      this.lotteryPlayPrice.set(formatEther(price));
      this.lotteryBalance.set(formatEther(balance));
      this.lotteryPointsAddress.set(pts);
      this.lotteryTreasuryAddress.set(treasury);
      this.lotteryPoolSize.set(poolSize.toString());
      this.lotteryTotalCommittedETH.set(formatEther(committedETH));
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
  auctionWithdrawFromPoolBatch() {
    const hashIds = this.aWithdrawPoolBatch.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('0x'));
    if (!hashIds.length) return;
    this.exec(() => this.adminSvc.auctionWithdrawFromPoolBatch(hashIds), () => this.loadAuctionState());
  }
  async auctionWithdrawAllFromPool() {
    const poolSize = parseInt(this.auctionPoolSize());
    if (!poolSize) return;
    if (!confirm(`Withdraw all ${poolSize} items from pool?`)) return;
    this.exec(async () => {
      const items = await this.adminSvc.getAuctionOrderItems();
      // getAuctionOrderItems only returns ordered queue; fetch all pool via contract
      // Fall back: use batch from textarea if pool getter not available
      const hashIds = this.aWithdrawPoolBatch.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('0x'));
      if (!hashIds.length) throw new Error('Paste pool hashIds into the batch field first');
      for (let i = 0; i < hashIds.length; i += 50) {
        await this.adminSvc.auctionWithdrawFromPoolBatch(hashIds.slice(i, i + 50));
      }
    }, () => this.loadAuctionState());
  }
  auctionEmergencyWithdraw() { this.exec(() => this.adminSvc.auctionEmergencyWithdrawEthscription(this.aEmergencyHashId)); }
  async auctionEmergencyWithdrawBatch() {
    const hashIds = this.aEmergencyBatch.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('0x'));
    if (!hashIds.length) return;
    if (!confirm(`Emergency withdraw ${hashIds.length} items? This sends ${hashIds.length} separate transactions.`)) return;
    this.txPending.set(true);
    let success = 0;
    for (const hashId of hashIds) {
      try {
        await this.adminSvc.auctionEmergencyWithdrawEthscription(hashId);
        success++;
        console.log(`[${success}/${hashIds.length}] withdrawn ${hashId}`);
      } catch (e) {
        console.error('Failed:', hashId, e);
      }
    }
    this.txPending.set(false);
    alert(`Done. ${success}/${hashIds.length} withdrawn.`);
  }
  auctionDepositEthscriptions() {
    const hashIds = this.aDepositHashIds.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('0x'));
    if (!hashIds.length) return;
    this.exec(() => this.adminSvc.auctionDepositEthscriptions(hashIds), () => this.loadAuctionState());
  }
  auctionSetItemReservePrices() {
    const hashIds = this.aSetItemReserveHashIds.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('0x'));
    const prices = this.aSetItemReservePrices.split(/[\n,]+/).map(s => parseEther(s.trim()));
    if (!hashIds.length || hashIds.length !== prices.length) return;
    this.exec(() => this.adminSvc.auctionSetItemReservePrices(hashIds, prices), () => this.loadAuctionState());
  }
  auctionSetAuctionOrder() {
    const hashIds = this.aSetAuctionOrderHashIds.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('0x'));
    if (!hashIds.length) return;
    this.exec(() => this.adminSvc.auctionSetAuctionOrder(hashIds), () => this.loadAuctionState());
  }
  auctionClearAuctionOrder() {
    this.exec(() => this.adminSvc.auctionClearAuctionOrder(), () => this.loadAuctionState());
  }
  transferAuctionOwnership() { this.exec(() => this.adminSvc.auctionTransferOwnership(this.aTransferOwnership)); }

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
  lotteryEmergencyWithdraw() { this.exec(() => this.adminSvc.lotteryEmergencyWithdrawEthscription(this.lEmergencyHashId)); }
  lotteryRedirectPendingReturns() { this.exec(() => this.adminSvc.lotteryRedirectPendingReturns(this.lRedirectFrom, this.lRedirectTo), () => this.loadLotteryState()); }
  async lotteryCheckPendingReturns() {
    try {
      const amount = await this.adminSvc.lotteryGetPendingReturns(this.lCheckPendingAddr);
      this.lotteryPendingReturns.set(formatEther(amount));
    } catch (e: any) {
      this.lotteryPendingReturns.set('Error');
    }
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
  evolveRegisterPairs() {
    const og = this.eRegisterOgHashes.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('0x'));
    const q = this.eRegisterQuantumHashes.split(/[\n,]+/).map(s => s.trim()).filter(s => s.startsWith('0x'));
    if (!og.length || og.length !== q.length) return;
    this.exec(() => this.adminSvc.evolveRegisterPairs(og, q), () => this.loadEvolveState());
  }
  transferEvolveOwnership() { this.exec(() => this.adminSvc.evolveTransferOwnership(this.eTransferOwnership)); }

  // Visibility actions
  async loadVisibility() {
    try {
      const { data } = await supabase.from('_global_config').select('*').eq('network', environment.chainId).limit(1);
      const config = data?.[0];
      if (config) {
        const hiddenSlugs = this.readHiddenSlugs(config);
        const ctf = this.stripInternalCollectionTraitFilters(config.collectionTraitFilters);

        this.adminPreview.set(localStorage.getItem('admin_preview') === 'true');
        this.maintenanceMode.set(config.maintenance ?? false);
        this.showMutate.set(config.showMutate ?? true);
        this.showDevolve.set(config.showDevolve ?? true);
        this.showLottery.set(config.showLottery ?? true);
        this.showAuction.set(config.showAuction ?? true);
        this.showPhunkSwap.set(config.showPhunkSwap ?? true);
        this.showPhunkquidity.set(config.showPhunkquidity ?? true);
        this.hiddenSlugs.set(hiddenSlugs);
        this.visHiddenSlugsInput = hiddenSlugs.join(', ');
        const sel: { [slug: string]: { [k: string]: string } } = {};
        for (const slug of this.ctfSlugs) {
          sel[slug] = { ...(ctf[slug] ?? {}) };
        }
        this.traitSelections.set(sel);
        if (!Object.keys(this.traitOptions()).length) {
          this.loadTraitOptions();
        }
      }
    } catch (e) { console.error('Visibility load error:', e); }
  }

  async toggleVisibility(field: string, current: boolean) {
    const newValue = !current;
    this.txPending.set(true);
    this.txError.set('');
    try {
      await this.persistAdminConfig({ [field]: newValue });
      // Update local signals directly — don't re-read Supabase (race condition)
      switch (field) {
        case 'maintenance': this.maintenanceMode.set(newValue); break;
        case 'showMutate': this.showMutate.set(newValue); break;
        case 'showDevolve': this.showDevolve.set(newValue); break;
        case 'showLottery': this.showLottery.set(newValue); break;
        case 'showAuction': this.showAuction.set(newValue); break;
        case 'showPhunkSwap': this.showPhunkSwap.set(newValue); break;
        case 'showPhunkquidity': this.showPhunkquidity.set(newValue); break;
      }
      const config = await firstValueFrom(this.store.select(appStateSelectors.selectConfig));
      this.store.dispatch(appStateActions.setGlobalConfig({ config: { ...config, [field]: newValue } }));
    } catch (e: any) {
      this.txError.set(e?.message || 'Failed');
    } finally {
      this.txPending.set(false);
    }
  }

  toggleAdminPreview() {
    const current = this.adminPreview();
    this.adminPreview.set(!current);
    localStorage.setItem('admin_preview', (!current).toString());
    // Reload page to apply
    window.location.reload();
  }

  async loadTraitOptions() {
    this.traitOptionsLoading.set(true);
    const result: { [slug: string]: { [k: string]: string[] } } = {};
    await Promise.all(this.ctfSlugs.map(async (slug) => {
      try {
        const attrItem = await firstValueFrom(this.dataSvc.getAttributes(slug));
        if (!attrItem) return;
        const allItems = Object.entries(attrItem);
        const totalItems = allItems.length;
        const traitMap = new Map<string, Set<string>>();
        const traitCount = new Map<string, number>();
        allItems.forEach(([, attrs]: [string, any[]]) => {
          const seen = new Set<string>();
          attrs.forEach((attr: any) => {
            if (attr.k === 'Description' || attr.k === 'Name') return;
            if (!traitMap.has(attr.k)) traitMap.set(attr.k, new Set());
            const values = Array.isArray(attr.v) ? attr.v : [attr.v];
            values.forEach((v: string) => traitMap.get(attr.k)!.add(v));
            if (!seen.has(attr.k)) {
              traitCount.set(attr.k, (traitCount.get(attr.k) || 0) + 1);
              seen.add(attr.k);
            }
          });
        });
        result[slug] = {};
        traitMap.forEach((vals, k) => {
          const sorted = Array.from(vals).sort();
          if ((traitCount.get(k) || 0) < totalItems) sorted.unshift('none');
          result[slug][k] = sorted;
        });
      } catch (e) {
        console.error(`Failed to load traits for ${slug}:`, e);
      }
    }));
    this.traitOptions.set(result);
    this.traitOptionsLoading.set(false);
  }

  toggleTraitValue(slug: string, traitKey: string, value: string) {
    const sel = { ...this.traitSelections() };
    const slugSel = { ...(sel[slug] ?? {}) };
    if (slugSel[traitKey] === value) {
      delete slugSel[traitKey];
    } else {
      slugSel[traitKey] = value;
    }
    sel[slug] = slugSel;
    this.traitSelections.set(sel);
  }

  async saveCollectionTraitFilters() {
    this.txPending.set(true);
    this.txError.set('');
    try {
      const sels = this.traitSelections();
      const updated: any = {};
      for (const slug of this.ctfSlugs) {
        updated[slug] = sels[slug] ?? {};
      }
      // Preserve __hiddenSlugs so saving trait filters doesn't wipe hidden collections
      updated.__hiddenSlugs = this.hiddenSlugs();
      await this.persistAdminConfig({ collectionTraitFilters: updated });
      // Update NgRx store immediately so market filters take effect without page refresh
      const currentConfig = await firstValueFrom(this.store.select(appStateSelectors.selectConfig));
      this.store.dispatch(appStateActions.setGlobalConfig({ config: { ...currentConfig, collectionTraitFilters: updated } }));
      // Don't call loadVisibility() — it races with Supabase and resets selections
    } catch (e: any) {
      this.txError.set(e?.message || 'Failed to save collection filters');
    } finally {
      this.txPending.set(false);
    }
  }

  isSlugHidden(slug: string): boolean {
    return this.hiddenSlugs().includes(slug);
  }

  async toggleSlug(slug: string) {
    this.txPending.set(true);
    this.txError.set('');
    try {
      const isHidden = this.isSlugHidden(slug);
      const current = [...this.hiddenSlugs()];
      if (isHidden) current.splice(current.indexOf(slug), 1);
      else current.push(slug);

      // Store inside collectionTraitFilters jsonb (real existing column — no SQL migration needed)
      const currentConfig = await firstValueFrom(this.store.select(appStateSelectors.selectConfig));
      const merged = { ...(currentConfig?.collectionTraitFilters || {}), __hiddenSlugs: current } as any;
      await this.persistAdminConfig({ collectionTraitFilters: merged });

      this.hiddenSlugs.set(current);
      this.visHiddenSlugsInput = current.join(', ');
      this.store.dispatch(appStateActions.setGlobalConfig({ config: { ...currentConfig, hiddenSlugs: current, collectionTraitFilters: merged } }));
    } catch (e: any) {
      this.txError.set(e?.message || 'Failed');
    } finally {
      this.txPending.set(false);
    }
  }

  private readHiddenSlugs(config: any): string[] {
    if (Array.isArray(config?.hiddenSlugs)) {
      return config.hiddenSlugs;
    }

    return Array.isArray(config?.collectionTraitFilters?.__hiddenSlugs)
      ? config.collectionTraitFilters.__hiddenSlugs
      : [];
  }

  private stripInternalCollectionTraitFilters(collectionTraitFilters: any): Record<string, any> {
    if (!collectionTraitFilters || typeof collectionTraitFilters !== 'object') {
      return {};
    }

    const { __hiddenSlugs, ...rest } = collectionTraitFilters;
    return rest;
  }

  private async persistAdminConfig(updates: Record<string, any>): Promise<void> {
    const address = await firstValueFrom(this.address$);
    if (!address) throw new Error('No admin wallet connected');

    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000;
    const payloadHash = this.hashString(this.stableStringify(updates));

    const auth = {
      address: address.toLowerCase(),
      network: environment.chainId,
      payloadHash,
      issuedAt: now,
      expiresAt,
    };

    const message = this.buildAdminConfigMessage(auth);
    const signature = await this.web3Svc.signMessage(message);

    const response = await fetch('/api/admin-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth,
        updates,
        signature,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to save admin config');
    }
  }

  private buildAdminConfigMessage(auth: {
    address: string;
    network: number;
    payloadHash: string;
    issuedAt: number;
    expiresAt: number;
  }): string {
    return [
      'EtherPhunks Admin Config Update',
      `Address: ${auth.address}`,
      `Network: ${auth.network}`,
      `Payload Hash: ${auth.payloadHash}`,
      `Issued At: ${auth.issuedAt}`,
      `Expires At: ${auth.expiresAt}`,
      '',
      'Signing this message does not cost gas.',
    ].join('\n');
  }

  private stableStringify(value: any): string {
    if (Array.isArray(value)) {
      return `[${value.map(item => this.stableStringify(item)).join(',')}]`;
    }

    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`).join(',')}}`;
    }

    return JSON.stringify(value);
  }

  private hashString(input: string): string {
    let hash = 2166136261;

    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    return `fnv1a_${(hash >>> 0).toString(16)}`;
  }

  // Pause All (Market, Auction, Lottery, Evolve)
  async pauseAll() {
    this.batchRunning.set(true);
    const steps: TransferStep[] = [
      { label: 'Market — pause', status: 'pending' },
      { label: 'Auction — pause', status: 'pending' },
      { label: 'Lottery (Standard) — pause', status: 'pending' },
      ...(this.hasSecondLottery ? [{ label: 'Lottery (Premium) — pause', status: 'pending' as const }] : []),
      { label: 'Evolve — pause', status: 'pending' },
    ];
    this.batchSteps.set([...steps]);

    const fns: (() => Promise<any>)[] = [
      () => this.adminSvc.marketPause(),
      () => this.adminSvc.auctionPause(),
      () => { this.adminSvc.setLotteryAddress(this.adminSvc.standardLotteryAddress); return this.adminSvc.lotteryPause(); },
      ...(this.hasSecondLottery ? [() => { this.adminSvc.setLotteryAddress(this.adminSvc.premiumLotteryAddress); return this.adminSvc.lotteryPause(); }] : []),
      () => this.adminSvc.evolvePause(),
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

  // Unpause All (Market, Auction, Lottery, Evolve)
  async unpauseAll() {
    this.batchRunning.set(true);
    const steps: TransferStep[] = [
      { label: 'Market — unpause', status: 'pending' },
      { label: 'Auction — unpause', status: 'pending' },
      { label: 'Lottery (Standard) — unpause', status: 'pending' },
      ...(this.hasSecondLottery ? [{ label: 'Lottery (Premium) — unpause', status: 'pending' as const }] : []),
      { label: 'Evolve — unpause', status: 'pending' },
    ];
    this.batchSteps.set([...steps]);

    const fns: (() => Promise<any>)[] = [
      () => this.adminSvc.marketUnpause(),
      () => this.adminSvc.auctionUnpause(),
      () => { this.adminSvc.setLotteryAddress(this.adminSvc.standardLotteryAddress); return this.adminSvc.lotteryUnpause(); },
      ...(this.hasSecondLottery ? [() => { this.adminSvc.setLotteryAddress(this.adminSvc.premiumLotteryAddress); return this.adminSvc.lotteryUnpause(); }] : []),
      () => this.adminSvc.evolveUnpause(),
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
      { label: 'Market ProxyAdmin — transferOwnership', status: 'pending' },
      { label: 'Auction ProxyAdmin — transferOwnership', status: 'pending' },
      { label: 'Evolve ProxyAdmin — transferOwnership', status: 'pending' },
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
      () => this.adminSvc.marketProxyAdminTransfer(newOwner),
      () => this.adminSvc.auctionProxyAdminTransfer(newOwner),
      () => this.adminSvc.evolveProxyAdminTransfer(newOwner),
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

  maskUrl(url: string): string {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      const key = parts[parts.length - 1] || '';
      const masked = key.length > 8 ? key.slice(0, 4) + '…' + key.slice(-4) : key;
      return `${u.hostname}${masked ? '/' + masked : ''}`;
    } catch {
      return url;
    }
  }

  async checkHealth() {
    const rpcs = [
      { name: 'Ankr A',      url: 'https://rpc.ankr.com/eth/545e600765426a4f17b1d59db878210f81e6fecbe581c0a745a7068c62fc1eb8' },
      { name: 'Ankr B',      url: 'https://rpc.ankr.com/eth/229b890a1dea15c5330378688e793eb0c44185c264c00144c928240d7cb0ec3f' },
      { name: 'Alchemy A (backup)', url: (environment as any).frontendBackupRpcUrl || '' },
      { name: 'Alchemy B (receipt)', url: (environment as any).receiptRpcUrl || environment.rpcHttpProvider },
      { name: 'Primary RPC', url: environment.rpcHttpProvider },
      { name: 'Relay (indexer)', url: `${environment.relayUrl}/rpc` },
    ].filter(r => r.url);

    this.healthChecking.set(true);
    this.healthResults.set(rpcs.map(r => ({ ...r, status: 'pending' as const })));

    const results: { name: string; url: string; status: 'ok' | 'error' | 'pending'; blockNumber?: string; latency?: number; error?: string }[] = await Promise.all(rpcs.map(async (rpc) => {
      const start = Date.now();
      try {
        const res = await fetch(rpc.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
          signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        const latency = Date.now() - start;
        if (data.result) {
          return { ...rpc, status: 'ok' as const, blockNumber: parseInt(data.result, 16).toString(), latency };
        }
        return { ...rpc, status: 'error' as const, error: data.error?.message || 'No result', latency };
      } catch (e: any) {
        return { ...rpc, status: 'error' as const, error: e?.message || 'Timeout', latency: Date.now() - start };
      }
    }));

    // Also check Supabase
    try {
      const start = Date.now();
      const { error } = await supabase.from('_global_config').select('network').limit(1);
      const latency = Date.now() - start;
      results.push({ name: 'Supabase', url: environment.supabaseUrl, status: (error ? 'error' : 'ok') as 'ok' | 'error', latency, error: error?.message });
    } catch (e: any) {
      results.push({ name: 'Supabase', url: environment.supabaseUrl, status: 'error' as const, latency: 0, error: e?.message });
    }

    this.healthResults.set(results);
    this.healthChecking.set(false);
  }
}
