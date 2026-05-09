import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { TimeagoModule } from 'ngx-timeago';

import { Store } from '@ngrx/store';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';

import { DataService } from '@/services/data.service';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

import { EventType, GlobalState } from '@/models/global-state';
import { Phunk } from '@/models/db';

import { environment } from 'src/environments/environment';
import { ZERO_ADDRESS } from '@/constants/utils';

import { BehaviorSubject, catchError, filter, map, of, switchMap } from 'rxjs';

type EventLabels = {
  [type in EventType]: string;
};

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TimeagoModule,
    LazyLoadImageModule,

    WalletAddressDirective,

    WeiToEthPipe,
  ],
  selector: 'app-tx-history',
  templateUrl: './tx-history.component.html',
  styleUrls: ['./tx-history.component.scss']
})

export class TxHistoryComponent implements OnChanges {

  ZERO_ADDRESS = ZERO_ADDRESS;
  explorerUrl = environment.explorerUrl;

  @Input() phunk!: Phunk;

  private fetchTxHistory = new BehaviorSubject<string | null>(null);
  fetchTxHistory$ = this.fetchTxHistory.asObservable();

  tokenSales$ = this.fetchTxHistory$.pipe(
    filter((hashId) => !!hashId),
    switchMap((hashId) => this.dataSvc.fetchSingleTokenEvents(hashId!)),
    catchError(error => {
      console.error('Error fetching transaction history', error);
      return of(null);
    })
  );

  eventLabelKeys: Partial<Record<EventType, string>> = {
    created: 'created',
    transfer: 'transfer',
    escrow: 'escrow',
    PhunkOffered: 'offered',
    PhunkBidEntered: 'bidEntered',
    PhunkBidWithdrawn: 'bidWithdrawn',
    PhunkBought: 'bought',
    PhunkNoLongerForSale: 'offerWithdrawn',
    bridgeOut: 'lock',
    bridgeIn: 'unlock',
    PrizeAwarded: 'won',
    Evolved: 'mutated',
    Devolved: 'devolved',
    AuctionCreated: 'auctionStart',
    AuctionBid: 'auctionBidOf',
    AuctionSettled: 'auctionWonBy',
  };

  constructor(
    private store: Store<GlobalState>,
    private dataSvc: DataService,
    public preferences: PhunkPreferencesService,
  ) {}

  t(key: string): string {
    return this.preferences.t(key);
  }

  eventLabel(type: EventType): string {
    return this.t(this.eventLabelKeys[type] || type);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.phunk && changes.phunk.currentValue) {
      this.fetchTxHistory.next(this.phunk.hashId);
    }
  }
}
