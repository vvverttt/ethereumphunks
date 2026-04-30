import { Component, OnDestroy, OnInit, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { formatEther, encodePacked, keccak256 } from 'viem';
import { supabase } from '@/services/supabase';
const suffix = environment.chainId === 1 ? '' : '_sepolia';
import { getWalletClient, getChainId, reconnect } from '@wagmi/core';

import { environment } from 'src/environments/environment';
import { GlobalState } from '@/models/global-state';
import { Web3Service } from '@/services/web3.service';
import { AuctionService, AuctionData, AuctionBidEvent, SettledAuction } from '@/services/auction.service';

const AUCTION_SWAP_ABI = [
  { inputs: [{ name: 'sendHashId', type: 'bytes32' }, { name: 'receiveHashId', type: 'bytes32' }, { name: 'proof', type: 'bytes32[]' }], name: 'swap', outputs: [], stateMutability: 'payable', type: 'function' },
  { inputs: [{ name: 'hashId', type: 'bytes32' }], name: 'cancelSwapDeposit', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: '', type: 'address' }, { name: '', type: 'bytes32' }], name: 'userEthscriptionPossiblyStored', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }, { name: '', type: 'bytes32' }], name: 'blocksRemainingUntilValidTransfer', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'swapFee', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;
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
  updating = signal(false);

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

  isAdmin = signal(false);

  // Auction 2 swap state
  isAuction2 = false;
  auction2Address = '0x2132622FF3178EF2574aF25D8EFdf94D6b7cc630' as `0x${string}`;
  poolItems = signal<any[]>([]);
  ownedV67Items = signal<any[]>([]);
  selectedV67: any = null;
  pendingSwapDeposit = signal<any>(null);
  pickedSwapItem = signal<any>(null);
  swapTxPending = signal(false);
  swapCooldownReady = signal(false);
  swapCooldownMessage = signal('Waiting for confirmation...');
  private merkleTree: string[][] = [];
  private get rpcClient() { return this.web3Svc.l1Client; }

  getImageUrl(item: { sha: string }): string {
    return environment.staticUrl + '/static/images/' + item.sha;
  }

  selectV67(item: any) {
    this.selectedV67 = this.selectedV67?.hashId === item.hashId ? null : item;
  }

  onPoolItemClick(item: any) {
    if (this.pendingSwapDeposit()) {
      this.pickedSwapItem.set(this.pickedSwapItem()?.hashId === item.hashId ? null : item);
    }
  }

  async loadAuction2Pool() {
    // Pool items = items owned by the auction 2 contract
    const { data } = await supabase
      .from('ethscriptions')
      .select('hashId,sha,tokenId')
      .eq('slug', 'cryptophunksv67')
      .eq('owner', this.auction2Address.toLowerCase())
      .order('tokenId')
      .limit(500);
    this.poolItems.set(data || []);

    // Load user's owned v67 items
    const address = await firstValueFrom(this.store.select(appStateSelectors.selectWalletAddress));
    if (address) {
      const { data: owned } = await supabase
        .from('ethscriptions')
        .select('hashId,sha,tokenId')
        .eq('slug', 'cryptophunksv67')
        .eq('owner', address.toLowerCase())
        .order('tokenId')
        .limit(200);
      this.ownedV67Items.set(owned || []);
    }

    // Restore pending deposit
    const saved = localStorage.getItem('auction2_pending_swap');
    if (saved) {
      try {
        const item = JSON.parse(saved);
        this.pendingSwapDeposit.set(item);
        this.pollSwapCooldown(item);
      } catch {}
    }
  }

  private async getWallet() {
    try {
      const chainId = getChainId(this.web3Svc.config);
      return await getWalletClient(this.web3Svc.config, { chainId });
    } catch {
      await reconnect(this.web3Svc.config);
      const chainId = getChainId(this.web3Svc.config);
      return await getWalletClient(this.web3Svc.config, { chainId });
    }
  }

  async onDepositForSwap() {
    const item = this.selectedV67;
    if (!item || this.swapTxPending()) return;
    this.swapTxPending.set(true);
    try {
      const walletClient = await this.getWallet();
      await walletClient.sendTransaction({
        to: this.auction2Address,
        data: item.hashId as `0x${string}`,
        chain: walletClient.chain,
      });
      this.pendingSwapDeposit.set(item);
      localStorage.setItem('auction2_pending_swap', JSON.stringify(item));
      this.pollSwapCooldown(item);
    } catch (e) {
      console.error('Deposit failed:', e);
    } finally {
      this.swapTxPending.set(false);
    }
  }

  async pollSwapCooldown(item: any) {
    const address = await firstValueFrom(this.store.select(appStateSelectors.selectWalletAddress));
    if (!address) return;
    const poll = setInterval(async () => {
      try {
        const stored = await this.rpcClient.readContract({
          address: this.auction2Address, abi: AUCTION_SWAP_ABI,
          functionName: 'userEthscriptionPossiblyStored',
          args: [address as `0x${string}`, item.hashId as `0x${string}`],
        });
        if (!stored) {
          this.swapCooldownMessage.set('Deposit not yet confirmed...');
          return;
        }
        const blocks = await this.rpcClient.readContract({
          address: this.auction2Address, abi: AUCTION_SWAP_ABI,
          functionName: 'blocksRemainingUntilValidTransfer',
          args: [address as `0x${string}`, item.hashId as `0x${string}`],
        });
        if (Number(blocks) === 0) {
          this.swapCooldownReady.set(true);
          this.swapCooldownMessage.set('Ready to swap!');
          clearInterval(poll);
        } else {
          this.swapCooldownMessage.set(`${Number(blocks)} blocks remaining...`);
        }
      } catch {}
    }, 12000);
  }

  async onCompleteAuctionSwap() {
    const item = this.pendingSwapDeposit();
    const picked = this.pickedSwapItem();
    if (!item || !picked || this.swapTxPending()) return;
    this.swapTxPending.set(true);
    try {
      await this.ensureMerkleTree();
      const proof = this.getMerkleProof(item.hashId);
      const swapFee = await this.rpcClient.readContract({
        address: this.auction2Address, abi: AUCTION_SWAP_ABI, functionName: 'swapFee',
      });
      const walletClient = await this.getWallet();
      const hash = await walletClient.writeContract({
        address: this.auction2Address,
        abi: AUCTION_SWAP_ABI,
        functionName: 'swap',
        args: [item.hashId as `0x${string}`, picked.hashId as `0x${string}`, proof as `0x${string}`[]],
        value: swapFee as bigint,
        chain: walletClient.chain,
      });
      await this.rpcClient.waitForTransactionReceipt({ hash });
      this.pendingSwapDeposit.set(null);
      this.pickedSwapItem.set(null);
      this.selectedV67 = null;
      this.swapCooldownReady.set(false);
      localStorage.removeItem('auction2_pending_swap');
      await this.loadAuction2Pool();
    } catch (e) {
      console.error('Swap failed:', e);
    } finally {
      this.swapTxPending.set(false);
    }
  }

  async onCancelSwap() {
    const item = this.pendingSwapDeposit();
    if (!item) {
      this.pickedSwapItem.set(null);
      return;
    }
    this.swapTxPending.set(true);
    try {
      const walletClient = await this.getWallet();
      const hash = await walletClient.writeContract({
        address: this.auction2Address,
        abi: AUCTION_SWAP_ABI,
        functionName: 'cancelSwapDeposit',
        args: [item.hashId as `0x${string}`],
        chain: walletClient.chain,
      });
      await this.rpcClient.waitForTransactionReceipt({ hash });
      this.pendingSwapDeposit.set(null);
      this.pickedSwapItem.set(null);
      this.swapCooldownReady.set(false);
      localStorage.removeItem('auction2_pending_swap');
    } catch (e) {
      console.error('Cancel failed:', e);
    } finally {
      this.swapTxPending.set(false);
    }
  }

  private async ensureMerkleTree() {
    if (this.merkleTree.length) return;
    const hashIds: string[] = [];
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from('ethscriptions')
        .select('hashId')
        .eq('slug', 'cryptophunksv67')
        .order('tokenId')
        .range(offset, offset + 999);
      if (!data?.length) break;
      hashIds.push(...data.map((d: any) => d.hashId.toLowerCase()));
      if (data.length < 1000) break;
      offset += 1000;
    }
    let layer = [...hashIds].sort();
    this.merkleTree = [layer];
    while (layer.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        if (i + 1 < layer.length) {
          const [a, b] = layer[i] < layer[i + 1] ? [layer[i], layer[i + 1]] : [layer[i + 1], layer[i]];
          next.push(keccak256(encodePacked(['bytes32', 'bytes32'], [a as `0x${string}`, b as `0x${string}`])));
        } else {
          next.push(layer[i]);
        }
      }
      this.merkleTree.push(next);
      layer = next;
    }
  }

  private getMerkleProof(hashId: string): string[] {
    const leaf = hashId.toLowerCase();
    let idx = this.merkleTree[0].indexOf(leaf);
    if (idx === -1) return [];
    const proof: string[] = [];
    for (let level = 0; level < this.merkleTree.length - 1; level++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (siblingIdx < this.merkleTree[level].length) proof.push(this.merkleTree[level][siblingIdx]);
      idx = Math.floor(idx / 2);
    }
    return proof;
  }

  private pollInterval: any;
  private realtimeChannel: any;

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
      this.isAuction2 = true;
      this.loadAuction2Pool();
    } else {
      this.auctionSvc.setAddress('');
    }

    // Check admin after wallet restores
    this.web3Svc.connectionReady?.then(() => this.checkAdmin());
    this.store.select(appStateSelectors.selectWalletAddress).subscribe(() => this.checkAdmin());
  }

  onMainImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    try {
      const tmp = document.createElement('canvas');
      tmp.width = img.naturalWidth;
      tmp.height = img.naturalHeight;
      const tmpCtx = tmp.getContext('2d', { willReadFrequently: true })!;
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

    // Realtime: refresh from DB immediately when a new bid lands
    this.realtimeChannel = supabase
      .channel('auction_bids_live')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'auctionBids' + suffix,
      }, () => {
        if (!this.isHistorical()) {
          this.updating.set(true);
          this.refreshAuctionFromDB().finally(() => this.updating.set(false));
        }
      })
      .subscribe();

    // Fallback poll (DB only) — tightens to 10s in last 5 minutes, otherwise 60s
    const schedulePoll = () => {
      const timeLeft = (this.auction()?.endTime ?? 0) * 1000 - Date.now();
      const delay = !this.auctionEnded() && timeLeft < 5 * 60 * 1000 && timeLeft > 0 ? 10_000 : 60_000;
      this.pollInterval = setTimeout(async () => {
        if (!this.isHistorical() && this.hasActiveAuction && !this.auctionEnded() && this.bids().length > 0) await this.refreshAuctionFromDB();
        schedulePoll();
      }, delay);
    };
    schedulePoll();
  }

  ngOnDestroy() {
    clearTimeout(this.pollInterval);
    if (this.realtimeChannel) supabase.removeChannel(this.realtimeChannel);
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
        // Load image/reserve first (fast), then bid history separately so it can't block.
        const [itemReserve, eth] = await Promise.all([
          this.auctionSvc.getItemReservePrice(auctionData.hashId),
          this.auctionSvc.getEthscriptionByHashId(auctionData.hashId),
        ]);

        this.reservePrice.set(formatEther(itemReserve > 0n ? itemReserve : globalReserve));

        // Bids load independently — DB-only now, won't hammer RPC.
        this.auctionSvc.getBidHistory(auctionData.auctionId).then(h => this.bids.set(h)).catch(() => {});

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

  async refreshAuctionFromDB(): Promise<void> {
    try {
      let updated = await this.auctionSvc.getCurrentAuctionFromDB();
      if (!updated) {
        // DB failed — fall back to RPC
        updated = await this.auctionSvc.getAuction();
      }
      if (!updated) return;
      this.auction.set(updated);
      if (updated.startTime > 0) {
        this.auctionEnded.set(Date.now() >= updated.endTime * 1000);
      }
      this.auctionSvc.getBidHistory(updated.auctionId).then(h => this.bids.set(h)).catch(() => {});
    } catch (err) {
      console.error('Failed to refresh auction:', err);
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

  async checkAdmin() {
    try {
      const address = await firstValueFrom(this.store.select(appStateSelectors.selectWalletAddress));
      if (!address) { this.isAdmin.set(false); return; }
      const owner = await this.auctionSvc.getOwner();
      this.isAdmin.set(owner === address.toLowerCase());
    } catch {
      this.isAdmin.set(false);
    }
  }

  async onWithdrawAllFromPool() {
    const items = this.poolItems();
    if (!items.length || this.swapTxPending()) return;
    this.swapTxPending.set(true);
    this.errorMessage.set('');
    try {
      const hashIds = items.map(i => i.hashId as `0x${string}`);
      const hash = await this.auctionSvc.withdrawFromPoolBatch(hashIds);
      if (hash) {
        this.txHash.set(hash);
        await this.web3Svc.pollReceipt(hash);
        this.txHash.set('');
        await this.loadAuction2Pool();
      }
    } catch (err: any) {
      this.errorMessage.set(err?.shortMessage || err?.message || 'Withdraw failed');
    } finally {
      this.swapTxPending.set(false);
    }
  }

  closeError() {
    this.errorMessage.set('');
  }
}
