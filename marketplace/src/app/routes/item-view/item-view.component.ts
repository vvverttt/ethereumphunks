import { CommonModule, TitleCasePipe } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ViewChild, ViewChildren, ElementRef, QueryList, Component, signal } from '@angular/core';

import { formatEther } from 'viem';
import { HttpClient } from '@angular/common/http';

import { Store } from '@ngrx/store';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { combineLatest, distinctUntilChanged, filter, firstValueFrom, fromEvent, map, shareReplay, switchMap, take, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PhunkBillboardComponent } from '@/components/phunk-billboard/phunk-billboard.component';
import { TxHistoryComponent } from '@/components/tx-history/tx-history.component';
import { BreadcrumbsComponent } from '@/components/breadcrumbs/breadcrumbs.component';
import { CommentsComponent } from '@/components/comments/comments.component';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { TraitCountPipe } from '@/pipes/trait-count.pipe';
import { RarityTierPipe } from '@/pipes/rarity-tier.pipe';
import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { FormatCashPipe } from '@/pipes/format-cash.pipe';
import { QueryParamsPipe } from '@/pipes/query-params.pipe';
import { IsNumberPipe } from '@/pipes/is-number';

import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';
import { ThemeService } from '@/services/theme.service';
import { UtilService } from '@/services/util.service';
import { EthsRocksService } from '@/services/ethsrocks.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

import { Phunk } from '@/models/db';
import { GlobalState, Notification } from '@/models/global-state';

import * as appStateActions from '@/state/actions/app-state.actions';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';

import * as marketStateActions from '@/state/actions/market-state.actions';

import { selectNotifications } from '@/state/selectors/notification.selectors';
import { upsertNotification } from '@/state/actions/notification.actions';

import { setChat } from '@/state/actions/chat.actions';

import { environment } from 'src/environments/environment';

interface ActionsState {
  sell: boolean;
  withdraw: boolean;
  transfer: boolean;
  escrow: boolean;
  privateSale: boolean;
  evolve: boolean;
  devolve: boolean;
  bid: boolean;
};

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,

    LazyLoadImageModule,

    PhunkBillboardComponent,
    TxHistoryComponent,
    WalletAddressDirective,
    BreadcrumbsComponent,
    CommentsComponent,

    TraitCountPipe,
    RarityTierPipe,
    TitleCasePipe,
    WeiToEthPipe,
    FormatCashPipe,
    QueryParamsPipe,
    IsNumberPipe,
  ],
  selector: 'app-phunk-item-view',
  templateUrl: './item-view.component.html',
  styleUrls: ['./item-view.component.scss']
})
export class ItemViewComponent {

  objectValues = Object.values;

  @ViewChild('sellPriceInput') sellPriceInput!: ElementRef<HTMLInputElement>;
  // @ViewChild('revShareInput') revShareInput!: ElementRef<HTMLInputElement>;
  @ViewChild('transferAddressInput') transferAddressInput!: ElementRef<HTMLInputElement>;

  @ViewChildren('collapsable') collapsable!: QueryList<ElementRef<HTMLDivElement>>;

  explorerUrl = environment.explorerUrl;
  externalMarketUrl = environment.externalMarketUrl;
  escrowAddress = environment.marketAddress;

  // Collections that are pure on-chain ERC-721C (not ethscriptions): link items to
  // the NFT (contract + tokenId) rather than an inscription tx, which no longer
  // reflects the token and would be misleading.
  readonly erc721cContracts: { [slug: string]: string } = {
    cryptophunksv67: '0x67b850c3c8790cc7ec76261b65fde60eFb6F1fe3',
  };
  oldMarketAddresses: string[] = (((environment as any).oldMarketAddresses) || []).map((a: string) => a.toLowerCase());

  // Placing bids is enabled in the UI ONLY for these collections. Every other
  // collection hides the Place Bid button (e.g. the viewing-only V67 collections,
  // Phikings, etc.). NOTE: withdrawing/confirming an EXISTING bid is never gated,
  // so anyone with an open bid can always pull it back, on any collection.
  private readonly bidsEnabledSlugs = new Set([
    'og-missing-phunks', 'og-dysto-phunks', 'ethsrocks',
  ]);

  bidsEnabled(phunk: Phunk | null | undefined): boolean {
    return !!phunk?.slug && this.bidsEnabledSlugs.has(phunk.slug);
  }

  actionsState = signal<ActionsState>({
    sell: false,
    withdraw: false,
    transfer: false,
    escrow: false,
    privateSale: false,
    evolve: false,
    devolve: false,
    bid: false,
  });

  transferAddress = new FormControl<string | null>('');
  listPrice = new FormControl<number | undefined>(undefined);
  // revShare = new FormControl<number | undefined>(undefined);
  listToAddress = new FormControl<string | null>('');
  bidPrice = new FormControl<number | undefined>(undefined);

  currentBid = signal<{ bidder: string; value: string; valueWei: bigint; acceptedBlock: number; accepted: boolean } | null>(null);

  // The owner-key the loaded currentBid is actually stored under on-chain. Usually
  // this equals bidOwner(phunk), but for an "orphaned" bid (item changed hands after
  // the bid was placed) it's the previous owner recovered from the indexer. Withdraw/
  // confirm must use THIS key, not the current owner, or the tx reverts ("No bid").
  private bidKeyOwner: string | null = null;

  singlePhunk$ = this.route.params.pipe(
    filter((params: any) => !!params.hashId),
    distinctUntilChanged((prev, curr) => prev.hashId === curr.hashId),
    switchMap((params: any) => this.dataSvc.fetchSinglePhunk(params.hashId)),
    tap((phunk: any) => {
      if (phunk?.slug) {
        this.store.dispatch(marketStateActions.setMarketSlug({ marketSlug: phunk.slug }));
      }
      this.isRegisteredPair.set(false);
      this.evolveCost.set(null);
      if (phunk?.hashId && this.web3Svc.isEvolveSlug(phunk.slug)) {
        this.web3Svc.readEvolveContract('registered', [phunk.hashId])
          .then((result: boolean) => {
            this.isRegisteredPair.set(result);
            if (result && this.web3Svc.isOgEvolveSlug(phunk.slug)) {
              this.loadEvolveCost(phunk.hashId);
            }
          })
          .catch(() => this.isRegisteredPair.set(false));
      }
      this.freeClaims.set(0);
      if (phunk?.slug && this.web3Svc.isOgEvolveSlug(phunk.slug)) {
        this.loadFreeClaims();
      }
      this.currentBid.set(null);
      if (phunk?.hashId && phunk?.owner) {
        this.loadCurrentBid(phunk);
      }
    }),
    shareReplay(1),
  );

  pendingTx$ = this.store.select(selectNotifications).pipe(
    filter((transactions) => !!transactions),
    switchMap((transactions) => this.singlePhunk$.pipe(
      filter((phunk) => !!phunk),
      map((phunk) => transactions.filter((tx) => tx?.hashId === phunk?.hashId && (tx.type === 'pending' || tx.type === 'wallet'))[0]),
    )),
  );

  isCooling$ = combineLatest([
    this.store.select(appStateSelectors.selectCooldowns),
    this.store.select(appStateSelectors.selectCurrentBlock),
  ]).pipe(
    switchMap(([cooldowns, currentBlock]) => this.singlePhunk$.pipe(
      filter((phunk) => !!phunk),
      map((phunk) => {
        const cooldownBlock = cooldowns?.[phunk?.hashId || ''];
        if (!cooldownBlock || cooldownBlock <= 0) return false;
        if (currentBlock > 0 && currentBlock >= cooldownBlock + this.web3Svc.maxCooldown) return false;
        return true;
      }),
    )),
  );

  blocksBehind$ = this.store.select(appStateSelectors.selectBlocksBehind).pipe(
    map((blocksBehind) => blocksBehind > 50),
  );

  globalConfig$ = this.store.select(appStateSelectors.selectConfig);
  walletAddress$ = this.store.select(appStateSelectors.selectWalletAddress);
  connected$ = this.store.select(appStateSelectors.selectConnected);
  theme$ = this.store.select(appStateSelectors.selectTheme);
  usd$ = this.store.select(dataStateSelectors.selectDisplayUsd);
  currentBlock$ = this.store.select(appStateSelectors.selectCurrentBlock);

  /** Contract's confirmBid cooldown (ETHSCRIPTION_TRANSFER_COOLDOWN_BLOCKS). */
  readonly BID_CONFIRM_COOLDOWN = 5;

  scrollY$ = fromEvent(document, 'scroll').pipe(
    map(() => (window.scrollY / 2) * -1),
  );

  isMobile$ = this.store.select(appStateSelectors.selectIsMobile);

  isRegisteredPair = signal<boolean>(false);
  evolveCost = signal<string | null>(null);
  freeClaims = signal<number>(0);

  expanded = false;

  constructor(
    private store: Store<GlobalState>,
    private http: HttpClient,
    public route: ActivatedRoute,
    public router: Router,
    public dataSvc: DataService,
    public web3Svc: Web3Service,
    public themeSvc: ThemeService,
    private utilSvc: UtilService,
    private ethsrocksSvc: EthsRocksService,
    public preferences: PhunkPreferencesService,
  ) {
    // Live-refresh the current bid status (Accepted → Confirm, withdrawn, etc.)
    // when the bids table changes — so a bidder watching the item page sees the
    // owner's accept land without a manual reload.
    this.dataSvc.watchBids().pipe(
      switchMap(() => this.singlePhunk$.pipe(take(1))),
      takeUntilDestroyed(),
    ).subscribe((phunk) => {
      if (phunk?.hashId && phunk?.owner) this.loadCurrentBid(phunk);
    });
  }

  t(key: string): string {
    return this.preferences.t(key);
  }

  private weiToEthPipe = new WeiToEthPipe();

  /** Translated "Accepting escrows your X and accepts the ΞY bid…" hint (interpolated). */
  bidEscrowHintText(phunk: Phunk): string {
    const name = phunk.collection?.singleName || 'item';
    const value = this.weiToEthPipe.transform(this.currentBid()?.value ?? null);
    return this.t('bidEscrowHint').replace('%name%', name).replace('%value%', String(value));
  }

  /** Translated placeholder for the bid input ("Must exceed Y ETH" / "Bid amount in ETH"). */
  bidAmountPlaceholderText(): string {
    const bid = this.currentBid();
    if (!bid) return this.t('bidAmountPlaceholder');
    return this.t('mustExceedEth').replace('%v%', String(this.weiToEthPipe.transform(bid.value)));
  }

  sellPhunk(): void {
    this.closeAll();
    this.actionsState.update((state) => ({ ...state, sell: true }));
    setTimeout(() => this.sellPriceInput?.nativeElement.focus(), 0);
  }

  bidPhunk(): void {
    this.closeAll();
    this.actionsState.update((state) => ({ ...state, bid: true }));
  }

  closeBid(): void {
    this.actionsState.update((state) => ({ ...state, bid: false }));
    this.bidPrice.setValue(undefined);
  }

  escrowPhunk(): void {
    this.closeAll();
    this.actionsState.update((state) => ({ ...state, escrow: true }));
  }

  transferPhunkAction(): void {
    this.closeAll();
    this.actionsState.update((state) => ({ ...state, transfer: true }));
    setTimeout(() => this.transferAddressInput?.nativeElement.focus(), 0);
  }

  privateSalePhunkAction(): void {
    this.actionsState.update((state) => ({ ...state, privateSale: true }));
  }

  closeListing(): void {
    this.actionsState.update((state) => ({ ...state, sell: false }));
    this.closePrivateSale();
    this.clearAll();
  }

  closeEscrow(): void {
    this.actionsState.update((state) => ({ ...state, escrow: false }));
  }

  closeTransfer(): void {
    this.actionsState.update((state) => ({ ...state, transfer: false }));
    this.clearAll();
  }

  closePrivateSale(): void {
    this.actionsState.update((state) => ({ ...state, privateSale: false }));
  }

  clearAll(): void {
    this.listPrice.setValue(undefined);
    this.listToAddress.setValue('');
    this.transferAddress.setValue('');
    this.bidPrice.setValue(undefined);
  }

  closeAll(): void {
    this.closeListing();
    this.closeTransfer();
    this.closeEscrow();
    this.closeBid();
  }

  async submitListing(phunk: Phunk): Promise<void> {

    const hashId = phunk.hashId;

    if (!hashId) throw new Error('Invalid hashId');
    if (!this.listPrice.value) return;

    const value = this.listPrice.value;
    // const revShare = (this.revShare.value || 0) * 1000;
    let address = this.listToAddress.value || undefined;

    // console.log({hashId, value, address});

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('offerPhunkForSale' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'offerPhunkForSale',
      hashId,
      tokenId: phunk.tokenId,
      value,
    };

    this.store.dispatch(upsertNotification({ notification }));

    try {
      await this.checkConsenus(phunk);

      if (address) {
        if (address?.endsWith('.eth')) {
          const ensOwner = await this.web3Svc.getEnsOwner(address);
          if (!ensOwner) throw new Error('ENS name not registered');
          address = ensOwner;
        }
        const validAddress = this.web3Svc.verifyAddress(address);
        if (!validAddress) throw new Error('Invalid address');
      }

      const targetMarket = this.web3Svc.resolveMarketAddress({ owner: phunk.owner, slug: phunk.slug });

      let hash;
      if (phunk.isEscrowed) {
        // Escrowed path: direct listing first.
        try {
          hash = await this.web3Svc.offerPhunkForSale(hashId, value, address, targetMarket);
        } catch (err: any) {
          const msg = `${err?.shortMessage || ''} ${err?.message || ''}`.toLowerCase();
          if (msg.includes('not in escrow') || msg.includes('escrow')) {
            // Indexed state can lag; recover by doing escrow+list.
            hash = await this.web3Svc.escrowAndOfferPhunkForSale(hashId, value, address, targetMarket);
          } else {
            throw err;
          }
        }
      } else {
        // UI shows not-escrowed, but check on-chain — indexed state can lag.
        const actuallyEscrowed = await this.web3Svc.isInEscrow(hashId, targetMarket);
        if (actuallyEscrowed) {
          hash = await this.web3Svc.offerPhunkForSale(hashId, value, address, targetMarket);
        } else {
          hash = await this.web3Svc.escrowAndOfferPhunkForSale(hashId, value, address, targetMarket);
        }
      }

      // this.initNotificationMessage();
      this.store.dispatch(upsertNotification({ notification }));

      notification = {
        ...notification,
        type: 'pending',
        hash,
      };

      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);

      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };
      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);

      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
      this.clearAll();
    }
  }

  async submitBid(phunk: Phunk): Promise<void> {
    if (!this.bidsEnabled(phunk)) return; // bids only enabled on allowlisted collections
    const hashId = phunk.hashId;
    if (!hashId) throw new Error('Invalid hashId');
    if (!this.bidPrice.value || this.bidPrice.value <= 0) return;
    if (!phunk.owner) throw new Error('Phunk has no owner');

    const value = this.bidPrice.value;

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('enterBid' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'enterBid',
      hashId,
      tokenId: phunk.tokenId,
      value,
    };

    this.store.dispatch(upsertNotification({ notification }));

    try {
      const hash = await this.web3Svc.enterBid(hashId, this.bidOwner(phunk), value);

      notification = { ...notification, type: 'pending', hash };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);

      notification = { ...notification, type: 'complete', hash: receipt.transactionHash };
      await this.loadCurrentBid(phunk);
      this.store.dispatch(appStateActions.checkHasWithdrawal());
    } catch (err) {
      console.log(err);
      notification = { ...notification, type: 'error', detail: err };
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
      this.closeBid();
    }
  }

  async withdrawBidAction(phunk: Phunk): Promise<void> {
    const hashId = phunk.hashId;
    if (!hashId || !phunk.owner) throw new Error('Invalid bid context');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('withdrawBid' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'withdrawBid',
      hashId,
      tokenId: phunk.tokenId,
    };
    this.store.dispatch(upsertNotification({ notification }));

    try {
      const hash = await this.web3Svc.withdrawBid(hashId, this.bidKeyOwner ?? this.bidOwner(phunk));
      notification = { ...notification, type: 'pending', hash };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = { ...notification, type: 'complete', hash: receipt.transactionHash };
      await this.loadCurrentBid(phunk);
      this.store.dispatch(appStateActions.checkHasWithdrawal());
    } catch (err) {
      console.log(err);
      notification = { ...notification, type: 'error', detail: err };
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  async acceptBidAction(phunk: Phunk): Promise<void> {
    const hashId = phunk.hashId;
    const bid = this.currentBid();
    if (!hashId || !bid) throw new Error('No bid to accept');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('acceptBid' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'acceptBid',
      hashId,
      tokenId: phunk.tokenId,
    };
    this.store.dispatch(upsertNotification({ notification }));

    try {
      // If the phunk isn't escrowed yet, escrow + accept in ONE tx (V3_3 combined path).
      // If it's already escrowed, the plain acceptBid suffices.
      let actuallyEscrowed = phunk.isEscrowed;
      if (!actuallyEscrowed) {
        // Indexed state can lag — confirm on-chain before deciding the path.
        actuallyEscrowed = await this.web3Svc.isInEscrow(hashId);
      }

      const hash = actuallyEscrowed
        ? await this.web3Svc.acceptBid(hashId, bid.bidder, bid.value)
        : await this.web3Svc.escrowAndAcceptBid(hashId, bid.bidder, bid.value);

      notification = { ...notification, type: 'pending', hash };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = { ...notification, type: 'complete', hash: receipt.transactionHash };
      await this.loadCurrentBid(phunk);
      this.store.dispatch(appStateActions.checkHasWithdrawal());
    } catch (err) {
      console.log(err);
      notification = { ...notification, type: 'error', detail: err };
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  async confirmBidAction(phunk: Phunk): Promise<void> {
    const hashId = phunk.hashId;
    if (!hashId || !phunk.owner) throw new Error('Invalid bid context');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('confirmBid' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'confirmBid',
      hashId,
      tokenId: phunk.tokenId,
    };
    this.store.dispatch(upsertNotification({ notification }));

    try {
      const hash = await this.web3Svc.confirmBid(hashId, this.bidKeyOwner ?? this.bidOwner(phunk));
      notification = { ...notification, type: 'pending', hash };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = { ...notification, type: 'complete', hash: receipt.transactionHash };
      await this.loadCurrentBid(phunk);
      this.store.dispatch(appStateActions.checkHasWithdrawal());
    } catch (err) {
      console.log(err);
      notification = { ...notification, type: 'error', detail: err };
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  /** The address a bid is keyed against. When a phunk is escrowed, the market
   *  contract is `owner` and the real owner is `prevOwner` — bids must be keyed
   *  to the real owner (the escrow depositor), since only they can acceptBid
   *  and confirmBid transfers from them. When not escrowed, it's the owner. */
  bidOwner(phunk: Phunk): string {
    if (phunk.isEscrowed && phunk.prevOwner) return phunk.prevOwner;
    if (phunk.nft?.owner) return phunk.nft.owner;
    return phunk.owner!;
  }

  /** True if the item is currently held by the old EtherPhunks market (listed there) —
   *  the owner must withdraw it from there before they can accept a bid on this market. */
  isOnOldMarket(phunk: Phunk): boolean {
    return this.oldMarketAddresses.includes((phunk?.owner || '').toLowerCase());
  }

  /** A bid is "orphaned" when the item changed hands after the bid was placed:
   *  it's keyed on-chain to a previous owner (bidKeyOwner) that is no longer the
   *  current owner, so the current owner CANNOT accept it (only the bidder can
   *  withdraw). Detected by bidKeyOwner != the current bid owner. */
  isOrphanedBid(phunk: Phunk): boolean {
    if (!this.currentBid() || !this.bidKeyOwner) return false;
    return this.bidKeyOwner.toLowerCase() !== this.bidOwner(phunk).toLowerCase();
  }

  /** True only if the connected wallet is the address the bid is actually keyed to
   *  on-chain (bidKeyOwner) and the bid is still open — i.e. it can really be accepted. */
  canAcceptBid(address: string | null | undefined): boolean {
    const bid = this.currentBid();
    if (!bid || bid.accepted || !address || !this.bidKeyOwner) return false;
    return this.bidKeyOwner.toLowerCase() === address.toLowerCase();
  }

  /** Role-aware "what happens next" guidance for the current bid, shown on the
   *  item page so both the owner and the bidder always know the next step. */
  bidNextStep(phunk: Phunk, address: string | null | undefined): string | null {
    const bid = this.currentBid();
    if (!bid || !address) return null;
    const a = address.toLowerCase();
    const isBidder = bid.bidder.toLowerCase() === a;
    const isOwner = this.bidOwner(phunk).toLowerCase() === a;

    if (!bid.accepted) {
      // Orphaned/dead bid — keyed to a past owner; not acceptable from here.
      if (this.isOrphanedBid(phunk)) {
        if (isBidder) return this.t('bidOrphanedBidder');
        if (isOwner) return this.t('bidOrphanedOwner');
        return null;
      }
      if (isOwner) {
        return this.isOnOldMarket(phunk)
          ? this.t('bidStep2WithdrawFirst')
          : this.t('bidStep2Accept');
      }
      if (isBidder) {
        return this.isOnOldMarket(phunk)
          ? this.t('bidStep1OnOldMarket')
          : this.t('bidStep1Waiting');
      }
      return null; // other viewers: the bid line + Place Bid (to outbid) is enough
    }
    // accepted — cooldown / confirm phase
    if (isBidder) return this.t('bidStep3Confirm');
    if (isOwner) return this.t('bidAcceptedOwnerWaiting');
    return this.t('bidAcceptedAwaitingConfirm');
  }

  /** Blocks the bidder still has to wait before confirmBid will succeed.
   *  Returns 0 when the bid is confirmable now (or no accepted bid). */
  confirmBlocksRemaining(currentBlock: number): number {
    const bid = this.currentBid();
    if (!bid || !bid.accepted || !bid.acceptedBlock) return 0;
    const ready = bid.acceptedBlock + this.BID_CONFIRM_COOLDOWN;
    return currentBlock > 0 && currentBlock < ready ? ready - currentBlock : 0;
  }

  async loadCurrentBid(phunk: Phunk): Promise<void> {
    this.bidKeyOwner = null;
    if (!phunk?.hashId || !phunk?.owner) {
      this.currentBid.set(null);
      return;
    }
    let keyOwner = this.bidOwner(phunk);
    let bid = await this.web3Svc.getBid(keyOwner, phunk.hashId);

    // Fallback for "orphaned" bids: if the item changed hands after the bid was
    // placed, the bid is keyed to a previous owner and a lookup by the current
    // owner finds nothing. Recover the original key from the indexer so the bidder
    // can still see — and withdraw — their locked ETH.
    if (!(bid && bid.hasBid)) {
      const storedKey = await this.dataSvc.getBidOwnerKey(phunk.hashId);
      if (storedKey && storedKey.toLowerCase() !== keyOwner.toLowerCase()) {
        const recovered = await this.web3Svc.getBid(storedKey, phunk.hashId);
        if (recovered && recovered.hasBid) {
          bid = recovered;
          keyOwner = storedKey;
        }
      }
    }

    if (bid && bid.hasBid) {
      this.bidKeyOwner = keyOwner;
      const acceptedBlock = Number(bid.acceptedBlock);
      this.currentBid.set({
        bidder: bid.bidder,
        value: bid.value.toString(),
        valueWei: bid.value,
        acceptedBlock,
        accepted: acceptedBlock > 0,
      });
    } else {
      this.currentBid.set(null);
    }
  }

  async sendToEscrow(phunk: Phunk): Promise<void> {
    const hashId = phunk.hashId;

    if (!hashId) throw new Error('Invalid hashId');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('sendToEscrow' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'sendToEscrow',
      hashId,
      tokenId: phunk.tokenId,
    };

    this.store.dispatch(upsertNotification({ notification }));

    try {
      await this.checkConsenus(phunk);

      const targetMarket = this.web3Svc.resolveMarketAddress({ slug: phunk.slug });
      const tokenId = phunk.hashId;
      const hash = await this.web3Svc.sendEthscriptionToContract(tokenId, targetMarket);

      notification = {
        ...notification,
        type: 'pending',
        hash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      // this.setNotificationCompleteMessage(receipt);
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);

      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  async phunkNoLongerForSale(phunk: Phunk): Promise<void> {
    const hashId = phunk.hashId;
    if (!hashId) throw new Error('Invalid hashId');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('phunkNoLongerForSale' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'phunkNoLongerForSale',
      hashId,
      tokenId: phunk.tokenId,
    };

    this.store.dispatch(upsertNotification({ notification }));

    try {
      const targetMarket = this.web3Svc.resolveMarketAddress({ owner: phunk.owner });

      const hash = await this.web3Svc.phunkNoLongerForSale(hashId, targetMarket);
      if (!hash) throw new Error('Could not process transaction');

      notification = {
        ...notification,
        type: 'pending',
        hash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);

      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);

      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  async buyPhunk(phunk: Phunk): Promise<void> {
    const hashId = phunk.hashId;
    if (!hashId) throw new Error('Invalid hashId');

    const value = phunk.listing?.minValue;

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('buyPhunk' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'buyPhunk',
      hashId,
      tokenId: phunk.tokenId,
      value: Number(this.web3Svc.weiToEth(value)),
    };

    this.store.dispatch(upsertNotification({ notification }));

    try {
      await this.checkConsenus(phunk);
      if (!phunk.prevOwner) throw new Error('Invalid prevOwner');

      const targetMarket = this.web3Svc.resolveMarketAddress({ owner: phunk.owner });

      const hash = await this.web3Svc.batchBuyPhunks([phunk], targetMarket);

      if (!hash) throw new Error('Could not process transaction');

      notification = {
        ...notification,
        type: 'pending',
        hash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);

      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  async transferPhunk(phunk: Phunk, address?: string): Promise<void> {
    const hashId = phunk.hashId;
    if (!hashId) throw new Error('Invalid hashId');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('transferPhunk' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'transferPhunk',
      hashId,
      tokenId: phunk.tokenId,
    };

    try {
      let toAddress: string | null = address || this.transferAddress.value;
      toAddress = await this.web3Svc.verifyAddressOrEns(toAddress);
      if (!toAddress) throw new Error('Invalid address');

      this.closeTransfer();
      this.store.dispatch(upsertNotification({ notification }));

      await this.checkConsenus(phunk);

      const hash = await this.web3Svc.transferPhunk(hashId, toAddress);
      notification = {
        ...notification,
        type: 'pending',
        hash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);
      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
      this.clearAll();
    }
  }

  async withdrawPhunk(phunk: Phunk): Promise<void> {
    const hashId = phunk.hashId;
    if (!hashId) throw new Error('Invalid hashId');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('withdrawPhunk' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'withdrawPhunk',
      hashId,
      tokenId: phunk.tokenId,
    };

    try {
      this.store.dispatch(upsertNotification({ notification }));

      const targetMarket = this.web3Svc.resolveMarketAddress({ owner: phunk.owner });
      const hash = await this.web3Svc.withdrawPhunk(hashId, targetMarket);
      if (!hash) throw new Error('Could not process transaction');
      notification = {
        ...notification,
        type: 'pending',
        hash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);
      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  async loadEvolveCost(hashId: string): Promise<void> {
    try {
      const pairId = await this.web3Svc.readEvolveContract('pairIdOf', [hashId]);
      const paid = await this.web3Svc.readEvolveContract('feePaid', [pairId]);
      if (paid) {
        this.evolveCost.set('0');
      } else {
        const fee = await this.web3Svc.readEvolveContract('evolveFee') as bigint;
        this.evolveCost.set(formatEther(fee));
      }
    } catch {
      this.evolveCost.set(null);
    }
  }

  async submitEvolve(phunk: Phunk): Promise<void> {
    const hashId = phunk.hashId;
    if (!hashId) throw new Error('Invalid hashId');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('evolvePhunk' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'evolvePhunk',
      hashId,
      tokenId: phunk.tokenId,
    };

    this.store.dispatch(upsertNotification({ notification }));

    try {
      await this.checkConsenus(phunk);

      const hash = await this.web3Svc.evolvePhunk(hashId);
      if (!hash) throw new Error('Could not process transaction');

      notification = {
        ...notification,
        type: 'pending',
        hash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);
      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  async submitDevolve(phunk: Phunk): Promise<void> {
    const hashId = phunk.hashId;
    if (!hashId) throw new Error('Invalid hashId');

    let notification: Notification = {
      id: this.utilSvc.createIdFromString('devolvePhunk' + hashId),
      timestamp: Date.now(),
      slug: phunk.slug,
      type: 'wallet',
      function: 'devolvePhunk',
      hashId,
      tokenId: phunk.tokenId,
    };

    this.store.dispatch(upsertNotification({ notification }));

    try {
      await this.checkConsenus(phunk);

      const hash = await this.web3Svc.devolvePhunk(hashId);
      if (!hash) throw new Error('Could not process transaction');

      notification = {
        ...notification,
        type: 'pending',
        hash,
      };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };

      this.store.dispatch(appStateActions.addCooldown({ cooldown: { [hashId]: Number(receipt.blockNumber) }}));
    } catch (err) {
      console.log(err);
      notification = {
        ...notification,
        type: 'error',
        detail: err,
      };
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  async checkConsenus(phunk: Phunk): Promise<void> {
    const res = await this.dataSvc.checkConsensus([phunk]);
    if (!res[0]?.consensus) throw new Error('Consensus not reached. Contact Support @etherphunks');
  }

  expand(): void {
    this.expanded = !this.expanded;
  }

  async loadFreeClaims(): Promise<void> {
    const address = this.web3Svc.getCurrentAddress();
    if (!address) return;
    try {
      const claims = await this.ethsrocksSvc.getFreeClaims(address);
      this.freeClaims.set(Number(claims));
    } catch {}
  }

  async submitFreeClaim(): Promise<void> {
    let notification: Notification = {
      id: 'freeClaim-' + Date.now(),
      timestamp: Date.now(),
      type: 'pending',
      function: 'freeClaim',
      hashId: '',
    };

    try {
      this.store.dispatch(upsertNotification({ notification }));
      const hash = await this.ethsrocksSvc.freeClaim();
      notification = { ...notification, hash: hash || '' };
      this.store.dispatch(upsertNotification({ notification }));

      const receipt = await this.web3Svc.pollReceipt(hash!);
      notification = {
        ...notification,
        type: 'complete',
        hash: receipt.transactionHash,
      };
      this.freeClaims.update(v => Math.max(0, v - 1));
    } catch (err) {
      console.log(err);
      notification = { ...notification, type: 'error', detail: err };
    } finally {
      this.store.dispatch(upsertNotification({ notification }));
    }
  }

  async setChat() {
    this.store.dispatch(setChat({
      active: true,
      toAddress: '0xf1Aa941d56041d47a9a18e99609A047707Fe96c7'
    }));
  }

  private readonly ATTR_COUNT_EXCLUDE = ['type', 'phunk type', 'punk type', 'skin type', 'gender', 'animal', 'species', 'special'];

  getPhunkAttrCount(attributes: any[]): number {
    return attributes.filter((a, i) => i > 0 && !this.ATTR_COUNT_EXCLUDE.includes((a.k || '').toLowerCase())).length;
  }

  getAttrCountRarity(slug: string, attrCount: number): { rarityClass: string; rarityLabel: string; pct: string; count: number } {
    try {
      const raw = localStorage.getItem(`${slug}__attr_page`);
      if (raw) {
        const cached = JSON.parse(raw);
        const row = cached.countRows?.find((r: any) => r.numTraits === attrCount);
        if (row) return {
          rarityClass: row.rarity.toLowerCase().replace(/ /g, '-'),
          rarityLabel: row.rarity,
          pct: row.pct,
          count: row.count,
        };
      }
    } catch {}
    return { rarityClass: 'common', rarityLabel: 'Common', pct: '', count: 0 };
  }
}
