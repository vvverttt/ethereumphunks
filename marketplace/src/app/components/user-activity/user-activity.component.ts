import { Component, effect, input, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Store } from '@ngrx/store';
import { TimeagoModule } from 'ngx-timeago';
import { LazyLoadImageModule } from 'ng-lazyload-image';
import { map, switchMap } from 'rxjs';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';
import { PhunkImageComponent } from '@/components/phunk-image/phunk-image.component';

import { DataService } from '@/services/data.service';

import { WeiToEthPipe } from '@/pipes/wei-to-eth.pipe';
import { TokenNumberPipe } from '@/pipes/token-number.pipe';

import { GlobalState } from '@/models/global-state';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LazyLoadImageModule,
    TimeagoModule,

    WalletAddressDirective,
    PhunkImageComponent,

    WeiToEthPipe,
    TokenNumberPipe,
  ],
  selector: 'app-user-activity',
  templateUrl: './user-activity.component.html',
  styleUrls: ['./user-activity.component.scss']
})
export class UserActivityComponent {
  private readonly prefs = inject(PhunkPreferencesService);

  /** Interface strings in the current language (see i18n/ui.en.ts). */
  t(key: string, params?: Record<string, string | number>): string {
    return this.prefs.t(key, params);
  }


  address = input.required<string>();
  events$ = toObservable(this.address).pipe(
    switchMap((address: string) => this.dataSvc.fetchUserEvents(address, 10)),
    // Mutation/Evolve retired — hide Evolved/Devolved events.
    map((events: any) => events ? events.filter((e: any) => e.type !== 'Evolved' && e.type !== 'Devolved') : events),
  )

  // Event type -> translation key (i18n/ui.en.ts or the preferences service table).
  labels: any = {
    PhunkBidEntered: 'newBidOf',
    PhunkBidWithdrawn: 'bidWithdrawn',
    PhunkOffered: 'offeredFor',
    PhunkBought: 'uaBoughtFor',
    transfer: 'transferredTo',
    created: 'uaCreatedBy',
    bridgeOut: 'uaBridgedBy',
    bridgeIn: 'bridgedUnlockedBy',
    Evolved: 'mutatedBy',
    Devolved: 'devolvedBy',
    // escrow: 'Escrowed by',
    // PhunkNoLongerForSale: 'Offer withdrawn',
  };

  usd$ = this.store.select(dataStateSelectors.selectDisplayUsd);

  constructor(
    private store: Store<GlobalState>,
    public dataSvc: DataService
  ) {}
}
