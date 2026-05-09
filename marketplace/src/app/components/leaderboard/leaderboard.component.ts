import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Store } from '@ngrx/store';

import { PhunkPreferencesService } from '@/services/phunk-preferences.service';

import { WalletAddressDirective } from '@/directives/wallet-address.directive';

import { GlobalState } from '@/models/global-state';

import * as dataStateSelectors from '@/state/selectors/data-state.selectors';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,

    WalletAddressDirective
  ],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss'
})
export class LeaderboardComponent {

  leaderboard$ = this.store.select(dataStateSelectors.selectLeaderboard);
  activeCollection$ = this.store.select(dataStateSelectors.selectActiveCollection);

  constructor(
    private store: Store<GlobalState>,
    private preferences: PhunkPreferencesService,
  ) {}

  t(key: string): string {
    return this.preferences.t(key);
  }

}
