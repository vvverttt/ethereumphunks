import { Component, computed, ElementRef, inject, input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Store } from '@ngrx/store';
import { NgSelectModule } from '@ng-select/ng-select';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { TimeagoModule } from 'ngx-timeago';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { DataService } from '@/services/data.service';
import { Web3Service } from '@/services/web3.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { EventType, GlobalState, TxFilterItem } from '@/models/global-state';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import * as appStateActions from '@/state/actions/app-state.actions';
import * as appStateSelectors from '@/state/selectors/app-state.selectors';

import { Collection } from '@/models/data.state';
import { firstValueFrom, map, tap } from 'rxjs';


@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LazyLoadImageModule,
    TimeagoModule,
    NgSelectModule,
    ReactiveFormsModule,
    FormsModule,

    WalletAddressDirective,
    WeiToEthPipe,
  ],
  selector: 'app-recent-activity',
  templateUrl: './recent-activity.component.html',
  styleUrls: ['./recent-activity.component.scss']
})
export class RecentActivityComponent {

  @ViewChild('scroller') scroller!: ElementRef<HTMLDivElement>;

  collection = input.required<Collection | null>();
  ogCollection = input<Collection | null>(null);
  public preferences = inject(PhunkPreferencesService);

  txFilters = computed<TxFilterItem[]>(() => {
    this.preferences.currentLanguage();

    const filters: TxFilterItem[] = [
      { label: this.t('all'), value: 'All' },
      { label: this.t('offered'), value: 'PhunkOffered' },
      { label: this.t('sold'), value: 'PhunkBought' },
      { label: this.t('transferred'), value: 'transfer' },
      { label: this.t('created'), value: 'created' },
      { label: this.t('won'), value: 'Won' },
      { label: 'Bids', value: 'Bids' },
      { label: this.t('auction'), value: 'AuctionBid' },
    ];

    const slug = this.collection()?.slug;
    if (!slug || this.web3Svc.isEvolveSlug(slug)) {
      filters.push(
        { label: this.t('mutated'), value: 'Evolved' },
        { label: this.t('devolved'), value: 'Devolved' },
      );
    }

    return filters;
  });

  _activeTxFilter: EventType = 'All';

  private labelKeys: Record<string, string> = {
    PhunkBidEntered: 'newBidOf',
    PhunkBidWithdrawn: 'bidWithdrawn',
    PhunkOffered: 'offeredFor',
    PhunkBought: 'bought',
    transfer: 'transferredTo',
    created: 'created',
    bridgeOut: 'bridgedLockedBy',
    bridgeIn: 'bridgedUnlockedBy',
    PrizeAwarded: 'inLotteryBy',
    escrow: 'escrowedBy',
    Evolved: 'mutatedBy',
    Devolved: 'devolvedBy',
    AuctionCreated: 'onAuction',
    AuctionBid: 'auctionBidOf',
    AuctionSettled: 'auctionWonBy',
  };

  usd$ = this.store.select(dataStateSelectors.selectUsd);
  events$ = this.store.select(dataStateSelectors.selectEvents);
  hasMore$ = this.events$.pipe(map(events => !!events && events.length > 0 && events.length % 48 === 0));

  constructor(
    private store: Store<GlobalState>,
    public dataSvc: DataService,
    private web3Svc: Web3Service,
  ) {
    this.store.dispatch(appStateActions.setEventTypeFilter({ eventTypeFilter: this._activeTxFilter }));
  }

  t(key: string): string {
    return this.preferences.t(key);
  }

  eventLabel(type: string): string {
    return this.t(this.labelKeys[type] || type);
  }

  /**
   * Returns the prismatic CSS class to apply to the token-id so it matches
   * the color of the action label (e.g. "#-4" turns magenta on a bid event,
   * cyan on a win, gold on a purchase). Returns empty string for event types
   * that don't have a colored label.
   */
  tokenIdClass(event: { type?: string | null; to?: string | null }): string {
    const t = event?.type;
    if (!t) return '';
    if (t === 'PhunkBought') return 'prismatic-bought';
    if (t === 'created') return 'prismatic-created';
    if (t === 'PrizeAwarded') return 'prismatic-won';
    if (t === 'AuctionBid') return 'prismatic-bid';
    if (t === 'BidEntered' || t === 'BidAccepted' || t === 'BidConfirmed' || t === 'BidWithdrawn' || t === 'BidRefunded') return 'prismatic-marketbid';
    if (t === 'transfer' || t === 'bridgeIn' || t === 'bridgeOut') return 'prismatic-transfer';
    if (t === 'PhunkOffered') return 'prismatic-offered';
    if (t === 'AuctionSettled' && event.to && event.to !== '0x0000000000000000000000000000000000000000') {
      return 'prismatic-won';
    }
    return '';
  }

  setActiveTxFilter(filter: TxFilterItem): void {
    this.store.dispatch(appStateActions.setEventTypeFilter({ eventTypeFilter: filter.value }));
    this.scroller?.nativeElement?.scrollTo({ left: 0, top: 0 });
  }

  async paginateEvents() {
    const page$ = this.store.select(appStateSelectors.selectEventPage);
    const page = await firstValueFrom(page$);
    // console.log('paginateEvents', page, page + 1);
    this.store.dispatch(appStateActions.setEventPage({ page: page + 1 }));
  }

  resetPagination() {
    this.store.dispatch(appStateActions.setEventPage({ page: 0 }));
    this.scroller?.nativeElement?.scrollTo({ left: 0, top: 0 });
  }
}
